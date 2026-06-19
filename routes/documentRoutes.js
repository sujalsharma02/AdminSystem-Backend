const express = require('express');
const router = express.Router();
const { upload, listDocuments, uploadDocument, deleteDocument, reindexDocuments } = require('../controllers/documentController');

router.get('/', listDocuments);
router.post('/upload', upload.single('file'), uploadDocument);
router.post('/reindex', reindexDocuments);
router.delete('/:id', deleteDocument);

module.exports = router;
