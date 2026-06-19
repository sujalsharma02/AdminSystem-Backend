// RAG orchestration: indexing documents and retrieving relevant chunks.
//
// Pipeline:
//   1. index()    -> chunk a document's text, embed each chunk with Voyage,
//                    and persist the vectors on the document.
//   2. retrieve() -> embed the question with Voyage, rank stored chunks by
//                    cosine similarity, then optionally rerank with Voyage
//                    for precision, and return the top matches.
//
// If Voyage is not configured (no VOYAGE_API_KEY) the service degrades
// gracefully to keyword overlap ranking so the feature keeps working.

const Document = require('../models/Document');
const voyage = require('./voyageService');
const { chunkText, cosineSimilarity } = require('../utils/rag');
const { tokenize } = require('../utils/workforce');

const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE) || 1000;
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP) || 200;
const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K) || 5;
// How many cosine candidates to hand to the reranker before trimming to topK.
const RERANK_CANDIDATES = Number(process.env.RAG_RERANK_CANDIDATES) || 20;

// Build embedded chunks for a piece of text. Returns [] if Voyage is off
// or the text is empty, leaving the caller to fall back to keyword search.
const buildChunks = async (text) => {
    const pieces = chunkText(text, { chunkSize: CHUNK_SIZE, overlap: CHUNK_OVERLAP });
    if (!pieces.length || !voyage.isConfigured()) {
        return { chunks: [], model: '' };
    }

    const embeddings = await voyage.embedDocuments(pieces);
    const chunks = pieces.map((piece, index) => ({
        index,
        text: piece,
        embedding: embeddings[index] || []
    })).filter((chunk) => chunk.embedding.length > 0);

    return { chunks, model: voyage.EMBED_MODEL };
};

// Embed and persist a single document's chunks. Best-effort: on failure it
// returns the document unchanged so uploads never hard-fail on indexing.
const indexDocument = async (documentDoc) => {
    if (!documentDoc) {
        return documentDoc;
    }

    try {
        const { chunks, model } = await buildChunks(documentDoc.content);
        documentDoc.chunks = chunks;
        documentDoc.embeddingModel = model;
        documentDoc.indexedAt = chunks.length ? new Date() : null;
        await documentDoc.save();
    } catch (error) {
        console.error(`RAG indexDocument error for "${documentDoc.name}":`, error.message);
    }

    return documentDoc;
};

// Re-index every document in the collection. Returns a small summary.
const reindexAll = async () => {
    const documents = await Document.find({});
    let indexed = 0;
    let totalChunks = 0;

    for (const doc of documents) {
        await indexDocument(doc);
        if (doc.chunks?.length) {
            indexed += 1;
            totalChunks += doc.chunks.length;
        }
    }

    return {
        documents: documents.length,
        indexed,
        totalChunks,
        embeddingModel: voyage.isConfigured() ? voyage.EMBED_MODEL : null
    };
};

// Flatten all stored chunks across the provided (or all) documents.
const collectChunks = (documents) => {
    const flat = [];
    for (const doc of documents) {
        const docId = doc._id ? doc._id.toString() : null;
        for (const chunk of doc.chunks || []) {
            if (chunk.embedding && chunk.embedding.length) {
                flat.push({
                    documentId: docId,
                    documentName: doc.name,
                    text: chunk.text,
                    embedding: chunk.embedding
                });
            }
        }
    }
    return flat;
};

// Keyword-overlap fallback used when embeddings are unavailable.
const keywordRetrieve = (question, documents, topK) => {
    const questionTokens = tokenize(question);
    const scored = [];

    for (const doc of documents) {
        const haystack = tokenize(`${doc.name || ''} ${doc.content || ''}`);
        const overlap = questionTokens.filter((token) => haystack.includes(token)).length;
        const snippet = String(doc.content || '').replace(/\s+/g, ' ').trim().slice(0, 600);
        scored.push({
            documentId: doc._id ? doc._id.toString() : null,
            documentName: doc.name,
            text: snippet,
            score: overlap
        });
    }

    return scored
        .filter((item) => item.text)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};

// Retrieve the most relevant chunks for a question.
// `scopeDocuments` optionally restricts retrieval to a provided in-memory set
// (used for the legacy "documents in request body" path); otherwise all
// indexed documents in the database are searched.
const retrieve = async (question, options = {}) => {
    const topK = options.topK || DEFAULT_TOP_K;
    const documents = options.scopeDocuments || await Document.find({});

    if (!documents.length) {
        return { method: 'none', model: null, matches: [] };
    }

    const queryEmbedding = voyage.isConfigured()
        ? await voyage.embedQuery(question).catch((error) => {
            console.error('RAG embedQuery error:', error.message);
            return null;
        })
        : null;

    const chunks = collectChunks(documents);

    // Fall back to keyword ranking when we can't do vector search.
    if (!queryEmbedding || !chunks.length) {
        return {
            method: 'keyword',
            model: null,
            matches: keywordRetrieve(question, documents, topK)
        };
    }

    // 1) Cosine similarity over every stored chunk.
    const ranked = chunks
        .map((chunk) => ({
            documentId: chunk.documentId,
            documentName: chunk.documentName,
            text: chunk.text,
            score: cosineSimilarity(queryEmbedding, chunk.embedding)
        }))
        .sort((a, b) => b.score - a.score);

    let method = 'vector';
    let candidates = ranked.slice(0, Math.max(topK, RERANK_CANDIDATES));

    // 2) Optional rerank pass for higher precision.
    try {
        const reranked = await voyage.rerank(
            question,
            candidates.map((item) => item.text),
            topK
        );
        if (reranked.length) {
            candidates = reranked.map((item) => ({
                ...candidates[item.index],
                score: item.relevanceScore
            }));
            method = 'vector+rerank';
        }
    } catch (error) {
        console.error('RAG rerank error (continuing with cosine scores):', error.message);
    }

    return {
        method,
        model: voyage.EMBED_MODEL,
        matches: candidates.slice(0, topK)
    };
};

module.exports = {
    buildChunks,
    indexDocument,
    reindexAll,
    retrieve
};
