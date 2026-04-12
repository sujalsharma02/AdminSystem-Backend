const express = require('express');
const {
    generateTaskDraft,
    recommendAssignee,
    getWorkloadInsights,
    askAboutDocuments
} = require('../controllers/aiController');

const router = express.Router();

router.post('/generate-task', generateTaskDraft);
router.post('/recommend-assignee', recommendAssignee);
router.post('/ask-docs', askAboutDocuments);
router.get('/workload-insights', getWorkloadInsights);

module.exports = router;
