const AuditLog = require('../models/AuditLog');
const Notification = require('../models/Notification');

const createAuditLog = async ({
    actorId = null,
    actorName = 'System',
    actorRole = 'system',
    action,
    entityType,
    entityId,
    summary,
    metadata = {}
}) => {
    try {
        return await AuditLog.create({
            actorId,
            actorName,
            actorRole,
            action,
            entityType,
            entityId,
            summary,
            metadata
        });
    } catch (error) {
        console.error('Audit log failed:', error.message);
        return null;
    }
};

const createNotification = async ({
    recipientId,
    title,
    message,
    type = 'system',
    entityType = '',
    entityId = ''
}) => {
    try {
        if (!recipientId) return null;
        return await Notification.create({
            recipientId,
            title,
            message,
            type,
            entityType,
            entityId
        });
    } catch (error) {
        console.error('Notification create failed:', error.message);
        return null;
    }
};

module.exports = { createAuditLog, createNotification };
