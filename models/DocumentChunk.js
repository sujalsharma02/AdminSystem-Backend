const mongoose = require('mongoose');

// One embedded slice of a document, stored as its own document so that
// Atlas Vector Search ($vectorSearch) can return the specific matching
// chunk (with a relevance score) rather than the whole parent document.
const documentChunkSchema = new mongoose.Schema({
    document: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Document',
        required: true,
        index: true
    },
    documentName: {
        type: String,
        default: ''
    },
    index: {
        type: Number,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    // Voyage AI embedding. The Atlas vectorSearch index is defined on this
    // path (see ragService.ensureVectorIndex).
    embedding: {
        type: [Number],
        default: []
    }
}, { timestamps: true });

module.exports = mongoose.model('DocumentChunk', documentChunkSchema);
