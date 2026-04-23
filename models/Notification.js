const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
    recipientId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true
    },
    title: {
        type: String,
        required: true,
        trim: true
    },
    message: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['task', 'leave', 'chat', 'system', 'escalation'],
        default: 'system'
    },
    entityType: {
        type: String,
        default: ''
    },
    entityId: {
        type: String,
        default: ''
    },
    read: {
        type: Boolean,
        default: false
    }
}, { timestamps: true });

module.exports = mongoose.model('Notification', notificationSchema);
