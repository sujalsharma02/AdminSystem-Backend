// RAG orchestration: indexing documents and retrieving relevant chunks
// using MongoDB Atlas Vector Search.
//
// Pipeline:
//   1. index()    -> chunk a document's text, embed each chunk with Voyage,
//                    and store each chunk in the DocumentChunk collection.
//   2. retrieve() -> embed the question with Voyage, run an Atlas
//                    $vectorSearch over the chunk embeddings, then optionally
//                    rerank with Voyage for precision, and return the top
//                    matches.
//
// Fallbacks keep the feature working when Atlas Vector Search or Voyage are
// unavailable: $vectorSearch -> in-memory cosine -> keyword overlap.

const Document = require('../models/Document');
const DocumentChunk = require('../models/DocumentChunk');
const voyage = require('./voyageService');
const { chunkText, cosineSimilarity } = require('../utils/rag');
const { tokenize } = require('../utils/workforce');

const CHUNK_SIZE = Number(process.env.RAG_CHUNK_SIZE) || 1000;
const CHUNK_OVERLAP = Number(process.env.RAG_CHUNK_OVERLAP) || 200;
const DEFAULT_TOP_K = Number(process.env.RAG_TOP_K) || 5;
// How many ANN candidates Atlas should consider before returning `limit`.
const NUM_CANDIDATES = Number(process.env.RAG_NUM_CANDIDATES) || 150;
const VECTOR_INDEX = process.env.RAG_VECTOR_INDEX || 'document_chunk_vector_index';

// ---------------------------------------------------------------------------
// Atlas vector index management
// ---------------------------------------------------------------------------

let ensureIndexPromise = null;

// Create the Atlas Vector Search index on DocumentChunk.embedding if it does
// not already exist. Best-effort and memoised: failures (e.g. a non-Atlas
// deployment) are logged and retrieval falls back to in-memory cosine.
const ensureVectorIndex = () => {
    if (ensureIndexPromise) {
        return ensureIndexPromise;
    }

    ensureIndexPromise = (async () => {
        const collection = DocumentChunk.collection;
        try {
            const existing = await collection.listSearchIndexes().toArray();
            if (existing.some((idx) => idx.name === VECTOR_INDEX)) {
                return true;
            }

            await collection.createSearchIndex({
                name: VECTOR_INDEX,
                type: 'vectorSearch',
                definition: {
                    fields: [
                        {
                            type: 'vector',
                            path: 'embedding',
                            numDimensions: voyage.EMBED_DIM,
                            similarity: 'cosine'
                        }
                    ]
                }
            });
            console.log(`Atlas vector index "${VECTOR_INDEX}" requested (builds asynchronously).`);
            return true;
        } catch (error) {
            console.error('ensureVectorIndex (falling back to in-memory cosine):', error.message);
            // Allow a later retry rather than caching the failure forever.
            ensureIndexPromise = null;
            return false;
        }
    })();

    return ensureIndexPromise;
};

// ---------------------------------------------------------------------------
// Indexing
// ---------------------------------------------------------------------------

// Build embedded chunks for a piece of text. Returns [] if Voyage is off or
// the text is empty, leaving the caller to fall back to keyword search.
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

// Embed and persist a single document's chunks into the DocumentChunk
// collection. Best-effort: on failure it leaves the document unindexed so
// uploads never hard-fail on indexing.
const indexDocument = async (documentDoc) => {
    if (!documentDoc) {
        return documentDoc;
    }

    try {
        const { chunks, model } = await buildChunks(documentDoc.content);

        // Replace any previous chunks for this document.
        await DocumentChunk.deleteMany({ document: documentDoc._id });
        if (chunks.length) {
            await DocumentChunk.insertMany(chunks.map((chunk) => ({
                document: documentDoc._id,
                documentName: documentDoc.name,
                index: chunk.index,
                text: chunk.text,
                embedding: chunk.embedding
            })));
            ensureVectorIndex();
        }

        documentDoc.chunkCount = chunks.length;
        documentDoc.embeddingModel = model;
        documentDoc.indexedAt = chunks.length ? new Date() : null;
        await documentDoc.save();
    } catch (error) {
        console.error(`RAG indexDocument error for "${documentDoc.name}":`, error.message);
    }

    return documentDoc;
};

// Remove a document's chunks (called when the document is deleted).
const removeDocumentChunks = (documentId) => DocumentChunk.deleteMany({ document: documentId });

// Re-index every document in the collection. Returns a small summary.
const reindexAll = async () => {
    const documents = await Document.find({});
    let indexed = 0;
    let totalChunks = 0;

    for (const doc of documents) {
        await indexDocument(doc);
        if (doc.chunkCount) {
            indexed += 1;
            totalChunks += doc.chunkCount;
        }
    }

    return {
        documents: documents.length,
        indexed,
        totalChunks,
        embeddingModel: voyage.isConfigured() ? voyage.EMBED_MODEL : null,
        vectorIndex: VECTOR_INDEX
    };
};

// ---------------------------------------------------------------------------
// Retrieval
// ---------------------------------------------------------------------------

// Atlas Vector Search over the stored chunk embeddings.
const atlasVectorSearch = async (queryEmbedding, topK) => {
    const results = await DocumentChunk.aggregate([
        {
            $vectorSearch: {
                index: VECTOR_INDEX,
                path: 'embedding',
                queryVector: queryEmbedding,
                numCandidates: Math.max(NUM_CANDIDATES, topK * 10),
                limit: topK
            }
        },
        {
            $project: {
                _id: 0,
                documentId: { $toString: '$document' },
                documentName: 1,
                text: 1,
                score: { $meta: 'vectorSearchScore' }
            }
        }
    ]);

    return results;
};

// In-memory cosine ranking over a flat list of { documentId, documentName,
// text, embedding } — used as a fallback and for transient (request-body)
// documents that are never persisted.
const inMemoryRank = (queryEmbedding, flatChunks, topK) => flatChunks
    .map((chunk) => ({
        documentId: chunk.documentId,
        documentName: chunk.documentName,
        text: chunk.text,
        score: cosineSimilarity(queryEmbedding, chunk.embedding)
    }))
    .sort((a, b) => b.score - a.score)
    .slice(0, topK);

// Keyword-overlap fallback used when embeddings are unavailable entirely.
const keywordRetrieve = async (question, scopeDocuments, topK) => {
    const documents = scopeDocuments || await Document.find({});
    const questionTokens = tokenize(question);

    return documents
        .map((doc) => {
            const haystack = tokenize(`${doc.name || ''} ${doc.content || ''}`);
            const overlap = questionTokens.filter((token) => haystack.includes(token)).length;
            return {
                documentId: doc._id ? doc._id.toString() : null,
                documentName: doc.name,
                text: String(doc.content || '').replace(/\s+/g, ' ').trim().slice(0, 600),
                score: overlap
            };
        })
        .filter((item) => item.text)
        .sort((a, b) => b.score - a.score)
        .slice(0, topK);
};

// Flatten chunks carried on in-memory scope documents (request-body path).
const collectScopeChunks = (documents) => {
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

// Optional Voyage rerank pass for higher precision. Returns the (possibly
// reordered) matches, never throws.
const maybeRerank = async (question, matches, topK) => {
    try {
        const reranked = await voyage.rerank(question, matches.map((m) => m.text), topK);
        if (reranked.length) {
            return {
                matches: reranked.map((item) => ({
                    ...matches[item.index],
                    score: item.relevanceScore
                })),
                reranked: true
            };
        }
    } catch (error) {
        console.error('RAG rerank error (continuing without rerank):', error.message);
    }
    return { matches: matches.slice(0, topK), reranked: false };
};

// Retrieve the most relevant chunks for a question.
// `scopeDocuments` optionally restricts retrieval to a provided in-memory set
// (the legacy "documents in request body" path); otherwise Atlas Vector
// Search runs over all indexed documents.
const retrieve = async (question, options = {}) => {
    const topK = options.topK || DEFAULT_TOP_K;
    const scopeDocuments = options.scopeDocuments;

    const queryEmbedding = voyage.isConfigured()
        ? await voyage.embedQuery(question).catch((error) => {
            console.error('RAG embedQuery error:', error.message);
            return null;
        })
        : null;

    // No embeddings available -> keyword fallback.
    if (!queryEmbedding) {
        return { method: 'keyword', model: null, reranked: false, matches: await keywordRetrieve(question, scopeDocuments, topK) };
    }

    let matches = [];
    let method = 'vector';

    if (scopeDocuments) {
        // Transient documents: rank in memory (they are never persisted).
        matches = inMemoryRank(queryEmbedding, collectScopeChunks(scopeDocuments), topK * 4);
        method = 'vector';
    } else {
        // Persisted documents: prefer Atlas Vector Search.
        const indexReady = await ensureVectorIndex();
        if (indexReady) {
            try {
                matches = await atlasVectorSearch(queryEmbedding, Math.max(topK * 4, topK));
                method = 'atlas-vector-search';
            } catch (error) {
                console.error('Atlas $vectorSearch failed (falling back to cosine):', error.message);
            }
        }

        // Fallback: pull stored chunks and rank in memory.
        if (!matches.length) {
            const stored = await DocumentChunk.find({}, 'documentName text embedding document').lean();
            if (stored.length) {
                matches = inMemoryRank(queryEmbedding, stored.map((c) => ({
                    documentId: c.document ? c.document.toString() : null,
                    documentName: c.documentName,
                    text: c.text,
                    embedding: c.embedding
                })), topK * 4);
                method = 'cosine';
            }
        }
    }

    if (!matches.length) {
        // Nothing embedded yet — last-resort keyword search.
        return { method: 'keyword', model: null, reranked: false, matches: await keywordRetrieve(question, scopeDocuments, topK) };
    }

    const { matches: finalMatches, reranked } = await maybeRerank(question, matches, topK);

    return {
        method,
        model: voyage.EMBED_MODEL,
        reranked,
        matches: finalMatches
    };
};

module.exports = {
    buildChunks,
    indexDocument,
    removeDocumentChunks,
    reindexAll,
    ensureVectorIndex,
    retrieve
};
