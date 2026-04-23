const express = require('express');
const router = express.Router();
const { upload, listDocuments, uploadDocument, deleteDocument } = require('../controllers/documentController');

router.get('/', listDocuments);
router.post('/upload', upload.single('file'), uploadDocument);
router.delete('/:id', deleteDocument);

module.exports = router;
