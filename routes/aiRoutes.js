const express = require('express');
const router = express.Router();
const { generateTask, recommendAssignee, workloadInsights, askDocs } = require('../controllers/aiController');

router.get('/workload-insights', workloadInsights);
router.post('/generate-task', generateTask);
router.post('/recommend-assignee', recommendAssignee);
router.post('/ask-docs', askDocs);

module.exports = router;
