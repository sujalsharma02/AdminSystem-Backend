const Document = require('../models/Document');
const { uploadToCloudinary } = require('../utils/cloudinary');

// @desc    Upload document
// @route   POST /api/documents/upload
// @access  Admin
const uploadDocument = async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ message: 'No file uploaded' });
        }

        const { content, authorId } = req.body;
        if (!content) {
            return res.status(400).json({ message: 'Document content is required' });
        }

        // Upload to Cloudinary
        const result = await uploadToCloudinary(req.file.buffer, req.file.originalname);

        // Save to Database
        const document = await Document.create({
            name: req.file.originalname,
            cloudinaryUrl: result.secure_url,
            content: content, // Text content for AI
            fileType: req.file.mimetype,
            authorId: authorId || 'admin'
        });

        res.status(201).json({ 
            message: 'Document uploaded and persisted successfully', 
            data: document 
        });
    } catch (error) {
        console.error('Upload Error:', error);
        res.status(500).json({ message: 'Upload failed', error: error.message });
    }
};

// @desc    Get all documents
// @route   GET /api/documents
// @access  Public (or Admin gated)
const getDocuments = async (req, res) => {
    try {
        const documents = await Document.find().sort({ createdAt: -1 });
        res.json({ message: 'Documents retrieved', data: documents });
    } catch (error) {
        res.status(500).json({ message: 'Failed to fetch documents', error: error.message });
    }
};

// @desc    Delete document
// @route   DELETE /api/documents/:id
// @access  Admin
const deleteDocument = async (req, res) => {
    try {
        const { id } = req.params;
        const document = await Document.findById(id);
        
        if (!document) {
            return res.status(404).json({ message: 'Document not found' });
        }

        // Optional: Could also delete from Cloudinary using public_id
        // but for now we focus on database removal
        await Document.findByIdAndDelete(id);
        
        res.json({ message: 'Document removed successfully' });
    } catch (error) {
        res.status(500).json({ message: 'Delete failed', error: error.message });
    }
};

module.exports = { uploadDocument, getDocuments, deleteDocument };
