const express = require('express');
const router = express.Router();
const { createTask, updateTaskStatus, deleteTask, addTaskComment } = require('../controllers/taskController');

router.post('/create', createTask);
router.patch('/:userId/:taskId/status', updateTaskStatus);
router.patch('/:userId/:taskId/comment', addTaskComment);
router.delete('/:userId/:taskId', deleteTask);

module.exports = router;
