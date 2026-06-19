const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true,
        trim: true
    },
    content: {
        type: String,
        default: ''
    },
    // RAG index metadata. The embedded chunks themselves live in the
    // DocumentChunk collection so Atlas Vector Search can query them.
    chunkCount: {
        type: Number,
        default: 0
    },
    embeddingModel: {
        type: String,
        default: ''
    },
    indexedAt: {
        type: Date,
        default: null
    },
    mimeType: {
        type: String,
        default: 'text/plain'
    },
    size: {
        type: Number,
        default: 0
    },
    uploadedBy: {
        type: String,
        default: 'admin'
    },
    source: {
        type: String,
        default: 'local'
    }
}, { timestamps: true });

module.exports = mongoose.model('Document', documentSchema);
