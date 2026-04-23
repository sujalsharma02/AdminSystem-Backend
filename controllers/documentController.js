const multer = require('multer');
const Document = require('../models/Document');

const upload = multer({ storage: multer.memoryStorage() });

const toText = (buffer) => {
    if (!buffer) return '';
    return buffer.toString('utf8');
};

const listDocuments = async (req, res) => {
    try {
        const documents = await Document.find({}).sort({ createdAt: -1 });
        return res.json({ data: documents });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const uploadDocument = async (req, res) => {
    try {
        const file = req.file;
        const { content, authorId, source } = req.body || {};

        if (!file && !content) {
            return res.status(400).json({ message: 'A file or content is required' });
        }

        const document = await Document.create({
            name: file?.originalname || req.body?.name || 'untitled.txt',
            content: content || toText(file?.buffer),
            mimeType: file?.mimetype || 'text/plain',
            size: file?.size || Buffer.byteLength(content || '', 'utf8'),
            uploadedBy: authorId || 'admin',
            source: source || (file ? 'upload' : 'manual')
        });

        return res.status(201).json({ data: document });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const deleteDocument = async (req, res) => {
    try {
        const document = await Document.findByIdAndDelete(req.params.id);
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        return res.json({ message: 'Document deleted', data: document });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { upload, listDocuments, uploadDocument, deleteDocument };
