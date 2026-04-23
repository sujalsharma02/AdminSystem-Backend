const User = require('../models/User');
const { createAuditLog, createNotification } = require('../utils/events');

const getAdminRecipients = async () => {
    return User.find({ role: { $in: ['admin', 'hr', 'manager', 'super_admin'] } });
};

const normalizePriority = (priority) => {
    return ['low', 'medium', 'high', 'critical'].includes(priority) ? priority : 'medium';
};

const isOverdue = (task) => {
    if (!task?.dueDate) return false;
    if (task.completed || task.failed) return false;
    const due = new Date(task.dueDate);
    if (Number.isNaN(due.getTime())) return false;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    due.setHours(23, 59, 59, 999);
    return due < today;
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:userId/:taskId
// @access  Admin


// @desc    Create a new task
// @route   POST /api/tasks/create
// @access  Admin
const createTask = async (req, res) => {
    const { taskTitle, taskDescription, taskDate, category, dueDate, priority } = req.body;
    const assignToRaw = req.body.assignTo;
    const assignToList = Array.isArray(assignToRaw)
        ? assignToRaw.filter(Boolean)
        : (typeof assignToRaw === 'string' && assignToRaw.trim() ? [assignToRaw.trim()] : []);

    if (!assignToList.length) {
        return res.status(400).json({ message: 'At least one employee is required in assignTo' });
    }

    try {
        const users = await User.find({ firstName: { $in: assignToList }, role: 'employee' });
        if (!users.length) {
            return res.status(404).json({ message: 'No matching employees found' });
        }

        const newTask = {
            taskTitle,
            taskDescription,
            taskDate,
            dueDate: dueDate || taskDate || '',
            category,
            priority: normalizePriority(priority),
            escalated: false,
            comments: [],
            active: false,
            newTask: true,
            failed: false,
            completed: false
        };

        const updatedUsers = [];
        for (const user of users) {
            user.tasks.push(newTask);
            user.taskCounts.newTask += 1;
            await user.save();
            updatedUsers.push(user);

            await createNotification({
                recipientId: user._id,
                title: 'New task assigned',
                message: `${taskTitle} is waiting in your task list.`,
                type: 'task',
                entityType: 'task',
                entityId: user.tasks[user.tasks.length - 1]._id.toString()
            });
        }

        await createAuditLog({
            actorName: req.body.authorName || 'System',
            actorRole: req.body.authorRole || 'admin',
            action: 'create_task',
            entityType: 'task',
            entityId: updatedUsers[0]?.tasks?.[updatedUsers[0].tasks.length - 1]?._id?.toString() || 'unknown',
            summary: `Created task "${taskTitle}" for ${updatedUsers.length} employee(s)`,
            metadata: { category, dueDate: dueDate || taskDate || '', priority: normalizePriority(priority) }
        });

        res.status(201).json({
            message: `Task created and assigned to ${updatedUsers.length} employee(s)`,
            data: updatedUsers[0],
            users: updatedUsers
        });
    } catch (error) {
        console.error("Error creating task:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Update task status
// @route   PATCH /api/tasks/:userId/:taskId/status
// @access  Employee
const updateTaskStatus = async (req, res) => {
    const { userId, taskId } = req.params;
    const { status } = req.body; // 'completed' or 'failed'

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const task = user.tasks.id(taskId);

        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        // Update task status
        if (status === 'completed') {
            task.completed = true;
            task.active = false;
            task.escalated = false;
            user.taskCounts.completed += 1;
            user.taskCounts.active = Math.max(0, user.taskCounts.active - 1);
        } else if (status === 'failed') {
            task.failed = true;
            task.active = false;
            task.escalated = true;
            user.taskCounts.failed += 1;
            user.taskCounts.active = Math.max(0, user.taskCounts.active - 1);
        } else if (status === 'active') {
            task.active = true;
            task.newTask = false;
            user.taskCounts.active += 1;
            user.taskCounts.newTask = Math.max(0, user.taskCounts.newTask - 1);
        }

        await user.save();

        await createAuditLog({
            actorName: req.body.authorName || user.firstName || 'System',
            actorRole: req.body.authorRole || 'employee',
            action: `task_${status}`,
            entityType: 'task',
            entityId: taskId,
            summary: `${user.firstName}'s task "${task.taskTitle}" marked as ${status}`,
            metadata: { userId, taskId, status }
        });

        const adminRecipients = await getAdminRecipients();
        const notificationTargets = [
            { recipientId: user._id, title: `Task ${status}`, message: `${task.taskTitle} was marked as ${status}.`, type: 'task' },
            ...adminRecipients.map((recipient) => ({
                recipientId: recipient._id,
                title: `Task ${status} update`,
                message: `${user.firstName} marked "${task.taskTitle}" as ${status}.`,
                type: 'task'
            }))
        ];

        await Promise.all(notificationTargets.map((item) => createNotification({
            ...item,
            entityType: 'task',
            entityId: taskId
        })));



        res.json({ message: `Task marked as ${status}`, data: user });
    } catch (error) {
        console.error("Error updating task status:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Delete a task
// @route   DELETE /api/tasks/:userId/:taskId
// @access  Admin
const deleteTask = async (req, res) => {
    const { userId, taskId } = req.params;

    try {
        const user = await User.findById(userId);

        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        // Filter out the task to be deleted
        const deletedTask = user.tasks.find(task => task._id.toString() === taskId);
        user.tasks = user.tasks.filter(task => task._id.toString() !== taskId);

        // Recalculate task counts
        user.taskCounts.active = user.tasks.filter(t => t.active).length;
        user.taskCounts.newTask = user.tasks.filter(t => t.newTask).length;
        user.taskCounts.completed = user.tasks.filter(t => t.completed).length;
        user.taskCounts.failed = user.tasks.filter(t => t.failed).length;

        await user.save();

        await createAuditLog({
            actorName: req.body?.authorName || 'System',
            actorRole: req.body?.authorRole || 'admin',
            action: 'delete_task',
            entityType: 'task',
            entityId: taskId,
            summary: `Deleted task "${deletedTask?.taskTitle || taskId}" from ${user.firstName}`,
            metadata: { userId, taskId }
        });

        res.json({ message: 'Task removed', data: user });
    } catch (error) {
        console.error("Error deleting task:", error);
        res.status(500).json({ message: error.message });
    }
};

// @desc    Add admin comment to a task
// @route   PATCH /api/tasks/:userId/:taskId/comment
// @access  Admin
const addTaskComment = async (req, res) => {
    const { userId, taskId } = req.params;
    const { text, authorName, authorRole } = req.body || {};

    if (!text || !text.trim()) {
        return res.status(400).json({ message: 'Comment text is required' });
    }

    try {
        const user = await User.findById(userId);
        if (!user) {
            return res.status(404).json({ message: 'User not found' });
        }

        const task = user.tasks.id(taskId);
        if (!task) {
            return res.status(404).json({ message: 'Task not found' });
        }

        if (!Array.isArray(task.comments)) {
            task.comments = [];
        }

        task.comments.push({
            text: text.trim(),
            authorName: authorName || 'Admin',
            authorRole: authorRole || 'admin',
            createdAt: new Date()
        });

        await user.save();

        await createAuditLog({
            actorName: authorName || 'Admin',
            actorRole: authorRole || 'admin',
            action: 'add_task_comment',
            entityType: 'task',
            entityId: taskId,
            summary: `Added comment to "${task.taskTitle}"`,
            metadata: { userId, taskId }
        });

        await createNotification({
            recipientId: user._id,
            title: 'New task comment',
            message: `A comment was added to "${task.taskTitle}".`,
            type: 'task',
            entityType: 'task',
            entityId: taskId
        });
        return res.json({ message: 'Comment added', data: user });
    } catch (error) {
        console.error("Error adding comment:", error);
        return res.status(500).json({ message: error.message });
    }
};

const scanOverdueTasks = async (req, res) => {
    try {
        const users = await User.find({ role: 'employee' });
        const escalated = [];
        const adminRecipients = await getAdminRecipients();

        for (const user of users) {
            let changed = false;
            for (const task of user.tasks) {
                if (isOverdue(task) && !task.escalated) {
                    task.escalated = true;
                    changed = true;
                    escalated.push({
                        userId: user._id.toString(),
                        taskId: task._id.toString(),
                        taskTitle: task.taskTitle
                    });

                    await createNotification({
                        recipientId: user._id,
                        title: 'Task overdue',
                        message: `"${task.taskTitle}" is overdue and has been escalated.`,
                        type: 'escalation',
                        entityType: 'task',
                        entityId: task._id.toString()
                    });

                    await Promise.all(adminRecipients.map((recipient) => createNotification({
                        recipientId: recipient._id,
                        title: 'Overdue task escalated',
                        message: `${user.firstName}'s task "${task.taskTitle}" is overdue.`,
                        type: 'escalation',
                        entityType: 'task',
                        entityId: task._id.toString()
                    })));
                }
            }

            if (changed) {
                await user.save();
            }
        }

        await createAuditLog({
            actorName: req.body?.authorName || 'System',
            actorRole: req.body?.authorRole || 'system',
            action: 'scan_overdue_tasks',
            entityType: 'task',
            entityId: 'batch',
            summary: `Escalated ${escalated.length} overdue task(s)`,
            metadata: { escalated }
        });

        return res.json({ message: 'Overdue task scan complete', data: { escalated } });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { createTask, updateTaskStatus, deleteTask, addTaskComment, scanOverdueTasks };
