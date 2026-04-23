const express = require('express');
const router = express.Router();
const {
    getTeamMessages,
    createTeamMessage,
    getDirectMessages,
    createDirectMessage
} = require('../controllers/chatController');

router.get('/messages', getTeamMessages);
router.post('/messages', createTeamMessage);
router.get('/threads/:threadId/messages', getDirectMessages);
router.post('/threads/:threadId/messages', createDirectMessage);

module.exports = router;
