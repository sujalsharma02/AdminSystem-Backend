const User = require('../models/User');
const { buildDueDate, scoreAssignee, calculateWorkload } = require('../utils/workforce');
const ragService = require('../services/ragService');
const { answerDocumentQuestionWithAI } = require('../services/aiService');

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

// Embed an in-memory set of documents (the legacy "documents in the request
// body" path) so retrieval can run against them without persisting anything.
const buildTransientScope = async (documents) => {
    const scope = [];
    for (const document of documents) {
        const { chunks, model } = await ragService.buildChunks(document.content || '');
        scope.push({
            _id: null,
            name: document.name || 'Document',
            content: document.content || '',
            chunks,
            embeddingModel: model
        });
    }
    return scope;
};

// Real RAG question answering:
//   retrieve relevant chunks (Voyage embeddings + rerank) -> generate a
//   grounded answer (Gemini) over only those chunks, with citations.
const askDocs = async (req, res) => {
    try {
        const { question = '', documents = [], topK } = req.body || {};
        if (!question.trim()) {
            return res.status(400).json({ message: 'question is required' });
        }

        // Default to the persisted, pre-indexed document store. Only use the
        // request-body documents when explicitly provided (backwards compat).
        const scopeDocuments = Array.isArray(documents) && documents.length
            ? await buildTransientScope(documents)
            : undefined;

        const retrieval = await ragService.retrieve(question, {
            topK: Number(topK) || undefined,
            scopeDocuments
        });

        if (!retrieval.matches.length) {
            return res.json({
                data: {
                    answer: 'I could not find any relevant content in the indexed documents.',
                    citations: [],
                    contexts: [],
                    retrieval: { method: retrieval.method, model: retrieval.model }
                }
            });
        }

        // Hand only the retrieved chunks to the generator as grounding context.
        const contextDocs = retrieval.matches.map((match, index) => ({
            name: `${match.documentName || 'Document'} [#${index + 1}]`,
            content: match.text
        }));

        const generated = await answerDocumentQuestionWithAI({
            question,
            documents: contextDocs
        });

        // De-duplicated source document names, ordered by relevance.
        const citations = [];
        for (const match of retrieval.matches) {
            if (match.documentName && !citations.includes(match.documentName)) {
                citations.push(match.documentName);
            }
        }

        return res.json({
            data: {
                answer: generated.answer,
                citations: generated.citations?.length ? generated.citations : citations,
                contexts: retrieval.matches.map((match) => ({
                    document: match.documentName,
                    score: Number(match.score?.toFixed?.(4) ?? match.score),
                    snippet: String(match.text || '').slice(0, 300)
                })),
                retrieval: {
                    method: retrieval.method,
                    embeddingModel: retrieval.model,
                    generator: generated.source
                }
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
