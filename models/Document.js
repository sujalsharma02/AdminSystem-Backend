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
