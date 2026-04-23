const express = require('express');
const router = express.Router();
const { authenticateToken, requireRoles } = require('../middleware/authMiddleware');
const { submitLeave, getMyLeaves, getAllLeaves, updateLeaveStatus } = require('../controllers/leaveController');

router.post('/', authenticateToken, submitLeave);
router.get('/my', authenticateToken, getMyLeaves);
router.get('/', authenticateToken, requireRoles('admin', 'hr', 'manager', 'super_admin'), getAllLeaves);
router.patch('/:leaveId/status', authenticateToken, requireRoles('admin', 'hr', 'manager', 'super_admin'), updateLeaveStatus);

module.exports = router;
