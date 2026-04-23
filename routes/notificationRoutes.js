const express = require('express');
const router = express.Router();
const { authenticateToken } = require('../middleware/authMiddleware');
const { listNotifications, unreadCount, markNotificationRead, markAllRead } = require('../controllers/notificationController');

router.get('/', authenticateToken, listNotifications);
router.get('/unread-count', authenticateToken, unreadCount);
router.patch('/:id/read', authenticateToken, markNotificationRead);
router.patch('/read-all', authenticateToken, markAllRead);

module.exports = router;
