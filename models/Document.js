const mongoose = require('mongoose');

const documentSchema = new mongoose.Schema({
    name: {
        type: String,
        required: true
    },
    cloudinaryUrl: {
        type: String,
        required: true
    },
    content: {
        type: String, // Storing extracted text for fast AI retrieval
        required: true
    },
    fileType: {
        type: String
    },
    authorId: {
        type: String, // Reference to the admin/user who uploaded
        default: 'admin' 
    },
    createdAt: {
        type: Date,
        default: Date.now
    }
});

module.exports = mongoose.model('Document', documentSchema);
