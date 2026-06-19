// Pure helpers for the RAG pipeline: text chunking and vector math.
// Kept dependency-free so they are easy to unit test and reuse.

// Split text into overlapping, word-bounded chunks. Overlap preserves
// context across chunk boundaries so an answer isn't cut in half.
const chunkText = (text, options = {}) => {
    const chunkSize = options.chunkSize || 1000; // characters
    const overlap = options.overlap != null ? options.overlap : 200;

    const clean = String(text || '').replace(/\r\n/g, '\n').trim();
    if (!clean) {
        return [];
    }

    if (clean.length <= chunkSize) {
        return [clean];
    }

    const chunks = [];
    let start = 0;

    while (start < clean.length) {
        let end = Math.min(start + chunkSize, clean.length);

        // Prefer to break on whitespace so we don't slice words in half.
        if (end < clean.length) {
            const window = clean.slice(start, end);
            const lastBreak = Math.max(window.lastIndexOf('\n'), window.lastIndexOf(' '));
            if (lastBreak > chunkSize * 0.5) {
                end = start + lastBreak + 1;
            }
        }

        const piece = clean.slice(start, end).trim();
        if (piece) {
            chunks.push(piece);
        }

        if (end >= clean.length) {
            break;
        }

        start = Math.max(end - overlap, start + 1);
    }

    return chunks;
};

const dot = (a, b) => {
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
        sum += a[i] * b[i];
    }
    return sum;
};

const magnitude = (vector) => Math.sqrt(dot(vector, vector));

const cosineSimilarity = (a, b) => {
    if (!Array.isArray(a) || !Array.isArray(b) || a.length !== b.length || !a.length) {
        return 0;
    }

    const magA = magnitude(a);
    const magB = magnitude(b);
    if (magA === 0 || magB === 0) {
        return 0;
    }

    return dot(a, b) / (magA * magB);
};

module.exports = {
    chunkText,
    cosineSimilarity
};
