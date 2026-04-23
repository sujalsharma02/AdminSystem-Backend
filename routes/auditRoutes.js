const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');
const { listAuditLogs } = require('../controllers/auditController');

router.get('/', authenticateToken, requireRoles('admin', 'hr', 'manager', 'super_admin'), listAuditLogs);

module.exports = router;
