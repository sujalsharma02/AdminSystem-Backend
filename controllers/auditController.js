const AuditLog = require('../models/AuditLog');

const listAuditLogs = async (req, res) => {
    try {
        const logs = await AuditLog.find({})
            .sort({ createdAt: -1 })
            .limit(200);

        return res.json({ data: logs });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { listAuditLogs };
