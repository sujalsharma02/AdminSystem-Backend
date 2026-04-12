const express = require('express');
const { listMessages, postMessage, listThreadMessages, postThreadMessage } = require('../controllers/chatController');

const router = express.Router();

router.get('/messages', listMessages);
router.post('/messages', postMessage);
router.get('/threads/:threadId/messages', listThreadMessages);
router.post('/threads/:threadId/messages', postThreadMessage);

module.exports = router;
