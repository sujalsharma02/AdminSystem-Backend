const MAX_MESSAGES = 200;
const chatMessages = [];
const threadMessages = new Map();

const listMessages = async (req, res) => {
    return res.json({ message: 'Chat messages', data: chatMessages });
};

const postMessage = async (req, res) => {
    const { text, authorName, authorRole } = req.body || {};

    if (!text || !text.trim()) {
        return res.status(400).json({ message: 'Message text is required' });
    }

    const message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        text: text.trim(),
        authorName: authorName || 'User',
        authorRole: authorRole || 'employee',
        createdAt: new Date().toISOString()
    };

    chatMessages.push(message);
    if (chatMessages.length > MAX_MESSAGES) {
        chatMessages.splice(0, chatMessages.length - MAX_MESSAGES);
    }

    return res.status(201).json({ message: 'Message posted', data: message });
};

const listThreadMessages = async (req, res) => {
    const { threadId } = req.params;
    if (!threadId) {
        return res.status(400).json({ message: 'threadId is required' });
    }
    const messages = threadMessages.get(threadId) || [];
    return res.json({ message: 'Thread messages', data: messages });
};

const postThreadMessage = async (req, res) => {
    const { threadId } = req.params;
    const { text, authorName, authorRole, authorId } = req.body || {};

    if (!threadId) {
        return res.status(400).json({ message: 'threadId is required' });
    }
    if (!text || !text.trim()) {
        return res.status(400).json({ message: 'Message text is required' });
    }

    const message = {
        id: `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`,
        threadId,
        text: text.trim(),
        authorName: authorName || 'User',
        authorRole: authorRole || 'employee',
        authorId: authorId || null,
        createdAt: new Date().toISOString()
    };

    const existing = threadMessages.get(threadId) || [];
    existing.push(message);
    if (existing.length > MAX_MESSAGES) {
        existing.splice(0, existing.length - MAX_MESSAGES);
    }
    threadMessages.set(threadId, existing);

    return res.status(201).json({ message: 'Thread message posted', data: message });
};

module.exports = { listMessages, postMessage, listThreadMessages, postThreadMessage };
