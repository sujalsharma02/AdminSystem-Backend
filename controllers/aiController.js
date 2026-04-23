const User = require('../models/User');
const { buildDueDate, scoreAssignee, calculateWorkload, tokenize } = require('../utils/workforce');

const createTaskDraft = (prompt = '', category = '', taskDate = '') => {
    const promptText = prompt.trim() || category.trim() || 'task';
    const words = promptText.split(/\s+/).filter(Boolean);
    const titleWords = words.slice(0, 5);
    const taskTitle = titleWords.map((word) => word.charAt(0).toUpperCase() + word.slice(1)).join(' ');
    const safeCategory = category.trim() || 'general';

    const instructionFragments = [
        `Break the work into one clear owner and a measurable outcome.`,
        `Document progress checkpoints and completion criteria.`,
        `Use the ${safeCategory} category to keep the assignment focused.`
    ];

    return {
        taskTitle: taskTitle || `Draft ${safeCategory} task`,
        taskDescription: `AI draft based on prompt: ${promptText}. ${instructionFragments.join(' ')}`,
        category: safeCategory,
        suggestedDueDate: buildDueDate(taskDate)
    };
};

const generateTask = async (req, res) => {
    try {
        const { prompt = '', category = '', taskDate = '' } = req.body || {};
        const draft = createTaskDraft(prompt, category, taskDate);
        return res.json({ data: draft });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const recommendAssignee = async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' });
        if (!employees.length) {
            return res.status(404).json({ message: 'No employees found' });
        }

        const scored = employees.map((employee) => {
            const metrics = scoreAssignee(employee, req.body || {});
            return {
                employee,
                ...metrics
            };
        }).sort((a, b) => b.score - a.score);

        const best = scored[0];
        const reasonParts = [
            `${best.employee.firstName} has a workload index of ${best.workload.loadIndex}.`,
            best.categoryAffinity > 0
                ? `They have category experience in ${req.body?.category || 'this area'}.`
                : 'They have a balanced task history for this request.',
            best.overlap > 0
                ? `Task wording overlaps with their previous assignments.`
                : 'The recommendation is driven mostly by current capacity.'
        ];

        return res.json({
            data: {
                assignTo: best.employee.firstName,
                reason: reasonParts.join(' '),
                confidence: `${Math.min(97, Math.max(56, best.score))}%`,
                source: 'workload + category history'
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const workloadInsights = async (req, res) => {
    try {
        const employees = await User.find({ role: 'employee' });
        const mapped = employees.map((employee) => {
            const metrics = calculateWorkload(employee);
            return {
                employee: employee.firstName,
                loadIndex: metrics.loadIndex,
                risk: metrics.risk,
                active: employee.taskCounts?.active || 0,
                newTask: employee.taskCounts?.newTask || 0,
                completed: employee.taskCounts?.completed || 0,
                failed: employee.taskCounts?.failed || 0
            };
        });

        const averageLoad = mapped.length
            ? Math.round(mapped.reduce((sum, item) => sum + item.loadIndex, 0) / mapped.length)
            : 0;

        const overloaded = mapped.filter((item) => item.risk === 'high').length;
        let teamRisk = 'low';
        if (averageLoad >= 70 || overloaded >= 2) {
            teamRisk = 'high';
        } else if (averageLoad >= 40 || overloaded === 1) {
            teamRisk = 'medium';
        }

        return res.json({
            data: {
                teamRisk,
                averageLoad,
                employees: mapped
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const rankDocuments = (question, documents = []) => {
    const questionTokens = tokenize(question);

    return documents.map((document) => {
        const haystack = tokenize(`${document.name || ''} ${document.content || ''}`);
        const overlap = questionTokens.filter((token) => haystack.includes(token)).length;
        return {
            document,
            score: overlap
        };
    }).sort((a, b) => b.score - a.score);
};

const askDocs = async (req, res) => {
    try {
        const { question = '', documents = [] } = req.body || {};
        if (!question.trim()) {
            return res.status(400).json({ message: 'question is required' });
        }
        if (!Array.isArray(documents) || !documents.length) {
            return res.status(400).json({ message: 'documents are required' });
        }

        const ranked = rankDocuments(question, documents).slice(0, 3);
        const citations = ranked.map(({ document }) => document.name).filter(Boolean);

        const answerParts = ranked.map(({ document, score }, index) => {
            const snippet = (document.content || '')
                .replace(/\s+/g, ' ')
                .trim()
                .slice(0, 220);

            return `${index + 1}. ${document.name}${score ? ` (matched ${score} keyword(s))` : ''}: ${snippet || 'No readable content provided.'}`;
        });

        const answer = answerParts.length
            ? `I found the most relevant material in the uploaded documents.\n${answerParts.join('\n')}`
            : 'I could not find a useful match in the uploaded documents.';

        return res.json({
            data: {
                answer,
                citations
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = {
    generateTask,
    recommendAssignee,
    workloadInsights,
    askDocs
};
