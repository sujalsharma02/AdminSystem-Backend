const express = require('express');
const router = express.Router();
const { createTask, updateTaskStatus, deleteTask, addTaskComment, scanOverdueTasks } = require('../controllers/taskController');

router.post('/create', createTask);
router.patch('/:userId/:taskId/status', updateTaskStatus);
router.patch('/:userId/:taskId/comment', addTaskComment);
router.delete('/:userId/:taskId', deleteTask);
router.post('/escalations/scan', scanOverdueTasks);

module.exports = router;
