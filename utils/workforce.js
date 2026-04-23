const clamp = (value, min, max) => Math.min(max, Math.max(min, value));

const normalizeText = (value = '') => value.toString().toLowerCase().replace(/[^a-z0-9\s-]/g, ' ');

const tokenize = (value = '') => normalizeText(value)
    .split(/\s+/)
    .map((item) => item.trim())
    .filter(Boolean);

const calculateWorkload = (user) => {
    const active = user.taskCounts?.active || 0;
    const queued = user.taskCounts?.newTask || 0;
    const completed = user.taskCounts?.completed || 0;
    const failed = user.taskCounts?.failed || 0;
    const leavePressure = user.leaveBalance
        ? Math.max(0, 10 - ((user.leaveBalance.annual || 0) + (user.leaveBalance.sick || 0) + (user.leaveBalance.casual || 0)))
        : 0;

    const loadIndex = clamp(
        Math.round((active * 18) + (queued * 10) + (failed * 12) - (completed * 4) + leavePressure),
        0,
        100
    );

    let risk = 'low';
    if (loadIndex >= 70) {
        risk = 'high';
    } else if (loadIndex >= 40) {
        risk = 'medium';
    }

    return { loadIndex, risk };
};

const computeCategoryAffinity = (user, category = '') => {
    const target = normalizeText(category);
    if (!target) return 0;

    const tasks = Array.isArray(user.tasks) ? user.tasks : [];
    const matches = tasks.filter((task) => normalizeText(task.category || '').includes(target));
    return matches.length;
};

const scoreAssignee = (user, payload = {}) => {
    const category = payload.category || '';
    const promptTokens = tokenize(`${payload.taskTitle || ''} ${payload.taskDescription || ''} ${category}`);
    const workload = calculateWorkload(user);
    const categoryAffinity = computeCategoryAffinity(user, category);
    const taskText = tokenize(
        (Array.isArray(user.tasks) ? user.tasks : [])
            .map((task) => `${task.taskTitle || ''} ${task.taskDescription || ''} ${task.category || ''}`)
            .join(' ')
    );

    const overlap = promptTokens.filter((token) => taskText.includes(token)).length;
    const completed = user.taskCounts?.completed || 0;
    const failed = user.taskCounts?.failed || 0;

    let score = 100;
    score -= workload.loadIndex;
    score += completed * 4;
    score -= failed * 10;
    score += categoryAffinity * 12;
    score += overlap * 2;

    return {
        score: clamp(score, 0, 100),
        workload,
        categoryAffinity,
        overlap
    };
};

const buildDueDate = (requestedDate) => {
    if (requestedDate) {
        return requestedDate;
    }

    const date = new Date();
    date.setDate(date.getDate() + 5);
    return date.toISOString().slice(0, 10);
};

module.exports = {
    calculateWorkload,
    scoreAssignee,
    buildDueDate,
    tokenize,
    normalizeText
};
