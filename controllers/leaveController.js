const Leave = require('../models/Leave');
const User = require('../models/User');

const toISODate = (value) => new Date(value).toISOString().slice(0, 10);

const getInclusiveDayCount = (fromDate, toDate) => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const msPerDay = 24 * 60 * 60 * 1000;
    const diff = Math.round((end.setHours(0, 0, 0, 0) - start.setHours(0, 0, 0, 0)) / msPerDay);
    return Math.max(1, diff + 1);
};

const getBalanceField = (leaveType) => {
    if (leaveType === 'annual') return 'annual';
    if (leaveType === 'sick') return 'sick';
    if (leaveType === 'casual') return 'casual';
    return 'unpaid';
};

const calculateRisk = (employee, payload, days) => {
    const activeLoad = (employee.taskCounts?.active || 0) + (employee.taskCounts?.newTask || 0);
    const balanceField = getBalanceField(payload.leaveType);
    const balance = employee.leaveBalance?.[balanceField] ?? 0;
    let score = 0;

    if (days >= 5) score += 2;
    if (days >= 3) score += 1;
    if (activeLoad >= 4) score += 2;
    if (activeLoad >= 2) score += 1;
    if (payload.leaveType !== 'unpaid' && balance < days) score += 3;
    if (payload.reason && payload.reason.length < 40) score += 1;

    let aiRisk = 'low';
    if (score >= 5) aiRisk = 'high';
    else if (score >= 2) aiRisk = 'medium';

    const aiSummary = `Requested ${payload.leaveType} leave for ${days} day(s). Current ${balanceField} balance: ${balance}. Workload snapshot: ${activeLoad} active/queued tasks.`;

    return { aiRisk, aiSummary };
};

const populateLeave = async (leave) => {
    return Leave.findById(leave._id)
        .populate('employee', 'firstName email role department leaveBalance taskCounts')
        .populate('reviewedBy', 'firstName email role');
};

const submitLeave = async (req, res) => {
    try {
        const { leaveType, fromDate, toDate, reason } = req.body || {};

        if (!leaveType || !fromDate || !toDate || !reason?.trim()) {
            return res.status(400).json({ message: 'leaveType, fromDate, toDate and reason are required' });
        }

        const employee = await User.findById(req.user._id);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const days = getInclusiveDayCount(fromDate, toDate);
        const risk = calculateRisk(employee, { leaveType, reason }, days);

        const leave = await Leave.create({
            employee: employee._id,
            leaveType,
            fromDate: new Date(fromDate),
            toDate: new Date(toDate),
            numberOfDays: days,
            reason: reason.trim(),
            status: 'pending',
            aiRisk: risk.aiRisk,
            aiSummary: risk.aiSummary
        });

        const populated = await populateLeave(leave);
        return res.status(201).json({ message: 'Leave request submitted', data: populated });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getMyLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({ employee: req.user._id })
            .sort({ createdAt: -1 })
            .populate('employee', 'firstName email role department leaveBalance taskCounts')
            .populate('reviewedBy', 'firstName email role');

        return res.json({ data: leaves });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const getAllLeaves = async (req, res) => {
    try {
        const leaves = await Leave.find({})
            .sort({ createdAt: -1 })
            .populate('employee', 'firstName email role department leaveBalance taskCounts')
            .populate('reviewedBy', 'firstName email role');

        return res.json({ data: leaves });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

const updateLeaveStatus = async (req, res) => {
    try {
        const { leaveId } = req.params;
        const { status, managerComment } = req.body || {};

        if (!['approved', 'rejected'].includes(status)) {
            return res.status(400).json({ message: 'Status must be approved or rejected' });
        }

        const leave = await Leave.findById(leaveId);
        if (!leave) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        const employee = await User.findById(leave.employee);
        if (!employee) {
            return res.status(404).json({ message: 'Employee not found' });
        }

        const balanceField = getBalanceField(leave.leaveType);
        const previousStatus = leave.status;
        const days = leave.numberOfDays || getInclusiveDayCount(leave.fromDate, leave.toDate);

        if (status === 'approved' && previousStatus !== 'approved' && leave.leaveType !== 'unpaid') {
            const balance = employee.leaveBalance?.[balanceField] ?? 0;
            if (balance < days) {
                return res.status(400).json({
                    message: `Insufficient ${balanceField} leave balance`,
                    data: { balance, required: days }
                });
            }
            employee.leaveBalance[balanceField] = balance - days;
            await employee.save();
        }

        if (status === 'rejected' && previousStatus === 'approved' && leave.leaveType !== 'unpaid') {
            const balance = employee.leaveBalance?.[balanceField] ?? 0;
            employee.leaveBalance[balanceField] = balance + days;
            await employee.save();
        }

        leave.status = status;
        leave.reviewedBy = req.user._id;
        leave.reviewDate = new Date();
        if (managerComment?.trim()) {
            leave.managerComment = managerComment.trim();
        }

        await leave.save();

        const populated = await populateLeave(leave);
        return res.json({ message: `Leave ${status}`, data: populated });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { submitLeave, getMyLeaves, getAllLeaves, updateLeaveStatus };
