const mongoose = require('mongoose');

const chatMessageSchema = new mongoose.Schema({
    threadId: {
        type: String,
        required: true,
        default: 'team'
    },
    scope: {
        type: String,
        enum: ['team', 'direct'],
        default: 'team'
    },
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User'
    }],
    authorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    authorName: {
        type: String,
        required: true,
        trim: true
    },
    authorRole: {
        type: String,
        default: 'employee'
    },
    text: {
        type: String,
        required: true,
        trim: true
    }
}, { timestamps: true });

module.exports = mongoose.model('ChatMessage', chatMessageSchema);
