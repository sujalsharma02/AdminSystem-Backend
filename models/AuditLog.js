const mongoose = require('mongoose');

const auditLogSchema = new mongoose.Schema({
    actorId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    actorName: {
        type: String,
        required: true,
        trim: true
    },
    actorRole: {
        type: String,
        default: 'system'
    },
    action: {
        type: String,
        required: true,
        trim: true
    },
    entityType: {
        type: String,
        required: true,
        trim: true
    },
    entityId: {
        type: String,
        required: true,
        trim: true
    },
    summary: {
        type: String,
        required: true,
        trim: true
    },
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {}
    }
}, { timestamps: true });

module.exports = mongoose.model('AuditLog', auditLogSchema);
