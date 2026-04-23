const ChatMessage = require('../models/ChatMessage');

const toClientMessage = (message) => ({
    id: message._id.toString(),
    threadId: message.threadId,
    scope: message.scope,
    authorName: message.authorName,
    authorRole: message.authorRole,
    authorId: message.authorId ? message.authorId.toString() : null,
    text: message.text,
    createdAt: message.createdAt,
    updatedAt: message.updatedAt
});

const getTeamMessages = async (req, res) => {
    try {
        const messages = await ChatMessage.find({ scope: 'team', threadId: 'team' })
            .sort({ createdAt: 1 })
            .lean();

        return res.json({ data: messages.map((message) => ({
            ...message,
            id: message._id.toString()
        })) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const createTeamMessage = async (req, res) => {
    try {
        const { text, authorName, authorRole, authorId } = req.body || {};
        if (!text || !text.trim()) {
            return res.status(400).json({ message: 'Message text is required' });
        }

        const message = await ChatMessage.create({
            threadId: 'team',
            scope: 'team',
            authorName: authorName || 'User',
            authorRole: authorRole || 'employee',
            authorId: authorId || null,
            text: text.trim()
        });

        return res.status(201).json({ data: toClientMessage(message) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getDirectMessages = async (req, res) => {
    try {
        const { threadId } = req.params;
        const messages = await ChatMessage.find({ scope: 'direct', threadId })
            .sort({ createdAt: 1 })
            .lean();

        return res.json({ data: messages.map((message) => ({
            ...message,
            id: message._id.toString()
        })) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const createDirectMessage = async (req, res) => {
    try {
        const { threadId } = req.params;
        const { text, authorName, authorRole, authorId } = req.body || {};
        if (!threadId) {
            return res.status(400).json({ message: 'threadId is required' });
        }
        if (!text || !text.trim()) {
            return res.status(400).json({ message: 'Message text is required' });
        }

        const message = await ChatMessage.create({
            threadId,
            scope: 'direct',
            authorName: authorName || 'User',
            authorRole: authorRole || 'employee',
            authorId: authorId || null,
            text: text.trim()
        });

        return res.status(201).json({ data: toClientMessage(message) });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    getTeamMessages,
    createTeamMessage,
    getDirectMessages,
    createDirectMessage
};
