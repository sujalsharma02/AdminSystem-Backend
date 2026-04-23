const Notification = require('../models/Notification');

const listNotifications = async (req, res) => {
    try {
        const notifications = await Notification.find({ recipientId: req.user._id })
            .sort({ createdAt: -1 })
            .limit(50);

        return res.json({ data: notifications });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const unreadCount = async (req, res) => {
    try {
        const count = await Notification.countDocuments({ recipientId: req.user._id, read: false });
        return res.json({ data: { count } });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const markNotificationRead = async (req, res) => {
    try {
        const notification = await Notification.findOneAndUpdate(
            { _id: req.params.id, recipientId: req.user._id },
            { read: true },
            { new: true }
        );

        if (!notification) {
            return res.status(404).json({ message: 'Notification not found' });
        }

        return res.json({ data: notification });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const markAllRead = async (req, res) => {
    try {
        await Notification.updateMany(
            { recipientId: req.user._id, read: false },
            { read: true }
        );
        return res.json({ message: 'Notifications marked as read' });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { listNotifications, unreadCount, markNotificationRead, markAllRead };
