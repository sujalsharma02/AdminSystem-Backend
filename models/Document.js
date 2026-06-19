const mongoose = require('mongoose');

// A single embedded slice of a document. The vector is produced by the
// Voyage AI embeddings model and used for similarity search at query time.
const chunkSchema = new mongoose.Schema({
    index: {
        type: Number,
        required: true
    },
    text: {
        type: String,
        required: true
    },
    embedding: {
        type: [Number],
        default: []
    }
}, { _id: false });

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
    // RAG index metadata.
    chunks: {
        type: [chunkSchema],
        default: []
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
