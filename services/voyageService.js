// Thin client for the Voyage AI REST API (embeddings + reranking).
// Voyage is Anthropic's recommended embeddings provider and powers the
// retrieval half of the RAG pipeline. Uses the global fetch (Node 18+).

const VOYAGE_BASE_URL = process.env.VOYAGE_BASE_URL || 'https://api.voyageai.com/v1';
const EMBED_MODEL = process.env.VOYAGE_EMBED_MODEL || 'voyage-3.5';
const RERANK_MODEL = process.env.VOYAGE_RERANK_MODEL || 'rerank-2.5-lite';
// Output dimension for the embeddings; must match the Atlas vector index.
const EMBED_DIM = Number(process.env.VOYAGE_OUTPUT_DIM) || 1024;

// Voyage accepts at most 128 inputs per embeddings request.
const MAX_BATCH = 128;

const isConfigured = () => Boolean(process.env.VOYAGE_API_KEY);

const callVoyage = async (path, body) => {
    if (!isConfigured()) {
        throw new Error('VOYAGE_API_KEY is not configured');
    }

    const response = await fetch(`${VOYAGE_BASE_URL}${path}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${process.env.VOYAGE_API_KEY}`
        },
        body: JSON.stringify(body)
    });

    if (!response.ok) {
        const detail = await response.text().catch(() => '');
        throw new Error(`Voyage API ${path} failed (${response.status}): ${detail.slice(0, 300)}`);
    }

    return response.json();
};

const chunkArray = (items, size) => {
    const batches = [];
    for (let i = 0; i < items.length; i += size) {
        batches.push(items.slice(i, i + size));
    }
    return batches;
};

// Embed a list of texts. `inputType` should be 'document' when embedding
// stored content and 'query' when embedding a user question, which lets
// Voyage optimise the vectors for asymmetric retrieval.
const embedTexts = async (texts, inputType = 'document') => {
    const inputs = (Array.isArray(texts) ? texts : [texts])
        .map((text) => (text == null ? '' : String(text)))
        .filter((text) => text.trim().length > 0);

    if (!inputs.length) {
        return [];
    }

    const embeddings = [];
    for (const batch of chunkArray(inputs, MAX_BATCH)) {
        const payload = await callVoyage('/embeddings', {
            input: batch,
            model: EMBED_MODEL,
            input_type: inputType,
            output_dimension: EMBED_DIM
        });

        const ordered = (payload.data || [])
            .slice()
            .sort((a, b) => a.index - b.index)
            .map((item) => item.embedding);

        embeddings.push(...ordered);
    }

    return embeddings;
};

const embedDocuments = (texts) => embedTexts(texts, 'document');

const embedQuery = async (text) => {
    const [embedding] = await embedTexts([text], 'query');
    return embedding || null;
};

// Rerank candidate documents against the query for higher precision.
// Returns an array of { index, relevanceScore } sorted by relevance.
const rerank = async (query, documents, topK) => {
    const docs = (Array.isArray(documents) ? documents : []).map((doc) => String(doc || ''));
    if (!docs.length) {
        return [];
    }

    const payload = await callVoyage('/rerank', {
        query: String(query || ''),
        documents: docs,
        model: RERANK_MODEL,
        top_k: topK || docs.length
    });

    return (payload.data || [])
        .slice()
        .sort((a, b) => b.relevance_score - a.relevance_score)
        .map((item) => ({ index: item.index, relevanceScore: item.relevance_score }));
};

module.exports = {
    isConfigured,
    embedTexts,
    embedDocuments,
    embedQuery,
    rerank,
    EMBED_MODEL,
    RERANK_MODEL,
    EMBED_DIM
};
