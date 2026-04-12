const User = require('../models/User');
const {
    generateTaskDraftWithAI,
    recommendAssigneeWithAI,
    buildWorkloadInsights,
    answerDocumentQuestionWithAI
} = require('../services/aiService');

// @desc    Generate AI task draft
// @route   POST /api/ai/generate-task
// @access  Admin
const generateTaskDraft = async (req, res) => {
    const { prompt, category, taskDate } = req.body || {};

    if (!prompt && !category) {
        return res.status(400).json({ message: 'Prompt or category is required' });
    }

    try {
        const draft = await generateTaskDraftWithAI({ prompt, category, taskDate });
        return res.json({ message: 'Task draft generated', data: draft });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to generate draft', error: error.message });
    }
};

// @desc    Recommend best assignee for a task
// @route   POST /api/ai/recommend-assignee
// @access  Admin
const recommendAssignee = async (req, res) => {
    const { taskTitle, taskDescription, category, taskDate } = req.body || {};

    if (!taskTitle && !taskDescription && !category) {
        return res.status(400).json({ message: 'Task details are required' });
    }

    try {
        const employees = await User.find({ role: 'employee' }).select('firstName taskCounts tasks');
        if (!employees.length) {
            return res.status(404).json({ message: 'No employees available' });
        }

        const recommendation = await recommendAssigneeWithAI({
            task: { taskTitle, taskDescription, category, taskDate },
            employees
        });

        return res.json({ message: 'Assignee recommendation ready', data: recommendation });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to recommend assignee', error: error.message });
    }
};

// @desc    Get team workload insights
// @route   GET /api/ai/workload-insights
// @access  Admin
const getWorkloadInsights = async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' }).select('firstName taskCounts');
        const insights = buildWorkloadInsights(employees);
        return res.json({ message: 'Workload insights generated', data: insights });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to generate workload insights', error: error.message });
    }
};

// @desc    Ask questions about uploaded documents
// @route   POST /api/ai/ask-docs
// @access  Admin
const askAboutDocuments = async (req, res) => {
    const { question, documents } = req.body || {};

    if (!question || !Array.isArray(documents) || documents.length === 0) {
        return res.status(400).json({ message: 'question and documents[] are required' });
    }

    try {
        const result = await answerDocumentQuestionWithAI({ question, documents });
        return res.json({ message: 'Document answer ready', data: result });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to answer document question', error: error.message });
    }
};

module.exports = {
    generateTaskDraft,
    recommendAssignee,
    getWorkloadInsights,
    askAboutDocuments
};
