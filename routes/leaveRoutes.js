const express = require('express');
const {
    createLeaveRequest,
    getMyLeaveRequests,
    getAllLeaveRequests,
    updateLeaveStatus
} = require('../controllers/leaveController');
const { protect, authorizeRoles } = require('../middleware/authMiddleware');

const router = express.Router();

router.use(protect);

router.post('/', authorizeRoles('employee', 'manager', 'hr', 'admin', 'super_admin'), createLeaveRequest);
router.get('/my', authorizeRoles('employee', 'manager', 'hr', 'admin', 'super_admin'), getMyLeaveRequests);
router.get('/', authorizeRoles('manager', 'hr', 'admin', 'super_admin'), getAllLeaveRequests);
router.patch('/:leaveId/status', authorizeRoles('manager', 'hr', 'admin', 'super_admin'), updateLeaveStatus);

module.exports = router;
