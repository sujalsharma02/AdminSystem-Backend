const OpenAI = require('openai');

const OPENAI_MODEL = process.env.OPENAI_MODEL || 'gpt-4.1-mini';

const getClient = () => {
    if (!process.env.OPENAI_API_KEY) {
        return null;
    }

    return new OpenAI({ apiKey: process.env.OPENAI_API_KEY });
};

const parseJsonSafely = (text) => {
    if (!text || typeof text !== 'string') {
        return null;
    }

    try {
        return JSON.parse(text);
    } catch (error) {
        const match = text.match(/\{[\s\S]*\}/);
        if (!match) {
            return null;
        }

        try {
            return JSON.parse(match[0]);
        } catch (innerError) {
            return null;
        }
    }
};

const toIsoDate = (daysToAdd) => {
    const date = new Date();
    date.setDate(date.getDate() + daysToAdd);
    return date.toISOString().split('T')[0];
};

const heuristicTaskDraft = ({ prompt, category }) => {
    const safePrompt = (prompt || '').trim();
    const safeCategory = (category || 'general').trim();
    const titleBase = safePrompt || `New ${safeCategory} task`;

    return {
        taskTitle: titleBase.slice(0, 80),
        taskDescription: `Objective: ${titleBase}. Deliverables: clear implementation notes, tested output, and status update in the system.`,
        category: safeCategory,
        suggestedDueDate: toIsoDate(3),
        priority: 'medium',
        successCriteria: [
            'Scope is implemented and documented',
            'Changes are validated by tests or manual QA',
            'Task status is updated with concise progress notes'
        ],
        source: 'heuristic'
    };
};

const buildEmployeeScore = (employee, category) => {
    const active = employee.taskCounts?.active || 0;
    const fresh = employee.taskCounts?.newTask || 0;
    const failed = employee.taskCounts?.failed || 0;
    const completed = employee.taskCounts?.completed || 0;
    const categoryMatches = (employee.tasks || []).filter((task) => {
        return (
            (task.category || '').toLowerCase() === (category || '').toLowerCase() &&
            task.completed
        );
    }).length;

    const workloadScore = (active * 3) + (fresh * 2) + (failed * 2) - completed - categoryMatches;
    return { workloadScore, categoryMatches };
};

const heuristicAssignee = ({ task, employees }) => {
    const category = task.category || 'general';
    const ranked = employees.map((employee) => {
        const { workloadScore, categoryMatches } = buildEmployeeScore(employee, category);
        return {
            name: employee.firstName,
            workloadScore,
            categoryMatches
        };
    }).sort((a, b) => a.workloadScore - b.workloadScore);

    const best = ranked[0];

    return {
        assignTo: best.name,
        confidence: best.categoryMatches > 0 ? 'high' : 'medium',
        reason: `${best.name} has the best load-to-skill balance for this ${category} task.`,
        rankedCandidates: ranked.slice(0, 3),
        source: 'heuristic'
    };
};

const generateTaskDraftWithAI = async ({ prompt, category, taskDate }) => {
    const client = getClient();
    if (!client) {
        return heuristicTaskDraft({ prompt, category, taskDate });
    }

    const input = [
        {
            role: 'system',
            content: 'You generate concise enterprise task drafts. Return only strict JSON.'
        },
        {
            role: 'user',
            content: `Create a task draft for this request: "${prompt || 'General admin task'}".
Category hint: "${category || 'general'}"
Due date hint: "${taskDate || 'not provided'}"

Return JSON with keys:
taskTitle (string),
taskDescription (string),
category (string),
suggestedDueDate (YYYY-MM-DD),
priority (low|medium|high),
successCriteria (array of 2-4 strings).`
        }
    ];

    try {
        const response = await client.responses.create({
            model: OPENAI_MODEL,
            input,
            temperature: 0.3
        });

        const text = response.output_text || '';
        const parsed = parseJsonSafely(text);
        if (!parsed) {
            return heuristicTaskDraft({ prompt, category, taskDate });
        }

        return {
            taskTitle: parsed.taskTitle || heuristicTaskDraft({ prompt, category }).taskTitle,
            taskDescription: parsed.taskDescription || '',
            category: parsed.category || category || 'general',
            suggestedDueDate: parsed.suggestedDueDate || taskDate || toIsoDate(3),
            priority: ['low', 'medium', 'high'].includes(parsed.priority) ? parsed.priority : 'medium',
            successCriteria: Array.isArray(parsed.successCriteria) ? parsed.successCriteria.slice(0, 4) : [],
            source: 'openai'
        };
    } catch (error) {
        return heuristicTaskDraft({ prompt, category, taskDate });
    }
};

const recommendAssigneeWithAI = async ({ task, employees }) => {
    const client = getClient();
    if (!client) {
        return heuristicAssignee({ task, employees });
    }

    const employeeSummary = employees.map((employee) => {
        return {
            firstName: employee.firstName,
            taskCounts: employee.taskCounts || {}
        };
    });

    const input = [
        {
            role: 'system',
            content: 'You recommend the best assignee for work balancing. Return only strict JSON.'
        },
        {
            role: 'user',
            content: `Task:
${JSON.stringify(task)}

Employees:
${JSON.stringify(employeeSummary)}

Return JSON with keys:
assignTo (employee firstName),
confidence (low|medium|high),
reason (string).`
        }
    ];

    try {
        const response = await client.responses.create({
            model: OPENAI_MODEL,
            input,
            temperature: 0.2
        });

        const parsed = parseJsonSafely(response.output_text || '');
        if (!parsed || !parsed.assignTo) {
            return heuristicAssignee({ task, employees });
        }

        const exists = employees.some((employee) => employee.firstName === parsed.assignTo);
        if (!exists) {
            return heuristicAssignee({ task, employees });
        }

        const ranked = heuristicAssignee({ task, employees }).rankedCandidates;

        return {
            assignTo: parsed.assignTo,
            confidence: ['low', 'medium', 'high'].includes(parsed.confidence) ? parsed.confidence : 'medium',
            reason: parsed.reason || 'Recommended based on workload and role fit.',
            rankedCandidates: ranked,
            source: 'openai'
        };
    } catch (error) {
        return heuristicAssignee({ task, employees });
    }
};

const buildWorkloadInsights = (employees) => {
    const insights = employees.map((employee) => {
        const active = employee.taskCounts?.active || 0;
        const fresh = employee.taskCounts?.newTask || 0;
        const failed = employee.taskCounts?.failed || 0;
        const completed = employee.taskCounts?.completed || 0;
        const loadIndex = (active * 3) + (fresh * 2) + (failed * 2) - completed;

        let risk = 'low';
        if (loadIndex > 6) {
            risk = 'high';
        } else if (loadIndex > 3) {
            risk = 'medium';
        }

        return {
            employee: employee.firstName,
            loadIndex,
            risk,
            taskCounts: employee.taskCounts || {}
        };
    }).sort((a, b) => b.loadIndex - a.loadIndex);

    return {
        generatedAt: new Date().toISOString(),
        teamRisk: insights[0]?.loadIndex > 6 ? 'high' : 'controlled',
        employees: insights
    };
};

const heuristicLeaveAnalysis = ({ leaveType, numberOfDays, reason }) => {
    const text = (reason || '').trim();
    const days = Number(numberOfDays) || 0;
    const type = leaveType || 'annual';

    let risk = 'low';
    if (days >= 8) {
        risk = 'high';
    } else if (days >= 4) {
        risk = 'medium';
    }

    const summary = `Requested ${days} day(s) of ${type} leave. Reason summary: ${text.slice(0, 180) || 'Not provided'}.`;
    return { risk, summary, source: 'heuristic' };
};

const analyzeLeaveRequestWithAI = async ({ leaveType, numberOfDays, reason }) => {
    const client = getClient();
    if (!client) {
        return heuristicLeaveAnalysis({ leaveType, numberOfDays, reason });
    }

    const input = [
        {
            role: 'system',
            content: 'You analyze leave requests for HR triage. Return only strict JSON.'
        },
        {
            role: 'user',
            content: `Analyze this leave request.
leaveType: "${leaveType}"
numberOfDays: ${numberOfDays}
reason: "${reason}"

Return JSON with keys:
risk (low|medium|high),
summary (string, max 220 chars).`
        }
    ];

    try {
        const response = await client.responses.create({
            model: OPENAI_MODEL,
            input,
            temperature: 0.2
        });

        const parsed = parseJsonSafely(response.output_text || '');
        if (!parsed) {
            return heuristicLeaveAnalysis({ leaveType, numberOfDays, reason });
        }

        return {
            risk: ['low', 'medium', 'high'].includes(parsed.risk) ? parsed.risk : 'low',
            summary: (parsed.summary || '').slice(0, 220),
            source: 'openai'
        };
    } catch (error) {
        return heuristicLeaveAnalysis({ leaveType, numberOfDays, reason });
    }
};

const heuristicDocumentAnswer = ({ question, documents }) => {
    const docs = Array.isArray(documents) ? documents : [];
    const q = (question || '').toLowerCase().trim();
    const qWords = q.split(/\s+/).filter((word) => word.length > 2);

    const snippets = docs.map((doc) => {
        const content = (doc.content || '').toString();
        const lines = content.split(/\r?\n/);
        const match = lines.find((line) => {
            const lower = line.toLowerCase();
            return qWords.some((word) => lower.includes(word));
        });
        return {
            name: doc.name || 'Document',
            snippet: (match || lines[0] || '').slice(0, 240)
        };
    }).filter((item) => item.snippet);

    if (!snippets.length) {
        return {
            answer: 'I could not find a clear match in the uploaded files. Try a more specific question.',
            citations: [],
            source: 'heuristic'
        };
    }

    return {
        answer: snippets.slice(0, 3).map((item) => `${item.name}: ${item.snippet}`).join('\n'),
        citations: snippets.slice(0, 3).map((item) => item.name),
        source: 'heuristic'
    };
};

const answerDocumentQuestionWithAI = async ({ question, documents }) => {
    const client = getClient();
    if (!client) {
        return heuristicDocumentAnswer({ question, documents });
    }

    const compactDocs = (Array.isArray(documents) ? documents : []).map((doc) => ({
        name: doc.name || 'Document',
        content: (doc.content || '').toString().slice(0, 6000)
    })).slice(0, 10);

    const input = [
        {
            role: 'system',
            content: 'You are a company document assistant. Answer from provided files only. Return strict JSON.'
        },
        {
            role: 'user',
            content: `Question: ${question}\n\nDocuments: ${JSON.stringify(compactDocs)}\n\nReturn JSON with keys:\nanswer (string), citations (array of file names).`
        }
    ];

    try {
        const response = await client.responses.create({
            model: OPENAI_MODEL,
            input,
            temperature: 0.2
        });

        const parsed = parseJsonSafely(response.output_text || '');
        if (!parsed || !parsed.answer) {
            return heuristicDocumentAnswer({ question, documents });
        }

        return {
            answer: parsed.answer,
            citations: Array.isArray(parsed.citations) ? parsed.citations.slice(0, 5) : [],
            source: 'openai'
        };
    } catch (error) {
        return heuristicDocumentAnswer({ question, documents });
    }
};

module.exports = {
    generateTaskDraftWithAI,
    recommendAssigneeWithAI,
    buildWorkloadInsights,
    analyzeLeaveRequestWithAI,
    answerDocumentQuestionWithAI
};
