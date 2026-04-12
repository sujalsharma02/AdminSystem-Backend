const LeaveRequest = require('../models/LeaveRequest');
const User = require('../models/User');
const { analyzeLeaveRequestWithAI } = require('../services/aiService');

const DAY_IN_MS = 24 * 60 * 60 * 1000;

const calculateNumberOfDays = (fromDate, toDate) => {
    const start = new Date(fromDate);
    const end = new Date(toDate);
    const diff = Math.floor((end - start) / DAY_IN_MS) + 1;
    return diff;
};

const createLeaveRequest = async (req, res) => {
    const { leaveType, fromDate, toDate, reason } = req.body || {};

    if (!leaveType || !fromDate || !toDate || !reason) {
        return res.status(400).json({ message: 'leaveType, fromDate, toDate, and reason are required' });
    }

    const numberOfDays = calculateNumberOfDays(fromDate, toDate);
    if (numberOfDays <= 0) {
        return res.status(400).json({ message: 'Invalid leave date range' });
    }

    try {
        const analysis = await analyzeLeaveRequestWithAI({ leaveType, numberOfDays, reason });

        const leaveRequest = await LeaveRequest.create({
            employee: req.user._id,
            leaveType,
            fromDate,
            toDate,
            numberOfDays,
            reason,
            aiSummary: analysis.summary || '',
            aiRisk: analysis.risk || 'low'
        });

        return res.status(201).json({ message: 'Leave request submitted', data: leaveRequest });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to create leave request', error: error.message });
    }
};

const getMyLeaveRequests = async (req, res) => {
    try {
        const leaves = await LeaveRequest.find({ employee: req.user._id })
            .sort({ createdAt: -1 })
            .populate('approver', 'firstName email role');

        return res.json({ message: 'My leave requests', data: leaves });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch leave requests', error: error.message });
    }
};

const getAllLeaveRequests = async (req, res) => {
    const { status, employeeId } = req.query || {};
    const filter = {};

    if (status) {
        filter.status = status;
    }
    if (employeeId) {
        filter.employee = employeeId;
    }

    try {
        const leaves = await LeaveRequest.find(filter)
            .sort({ createdAt: -1 })
            .populate('employee', 'firstName email role department managerId')
            .populate('approver', 'firstName email role');

        return res.json({ message: 'Leave requests', data: leaves });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to fetch leave requests', error: error.message });
    }
};

const updateLeaveStatus = async (req, res) => {
    const { leaveId } = req.params;
    const { status, approverComment } = req.body || {};

    if (!['approved', 'rejected', 'cancelled'].includes(status)) {
        return res.status(400).json({ message: 'Invalid status update' });
    }

    try {
        const leave = await LeaveRequest.findById(leaveId);
        if (!leave) {
            return res.status(404).json({ message: 'Leave request not found' });
        }

        leave.status = status;
        leave.approver = req.user._id;
        leave.approverComment = approverComment || '';
        await leave.save();

        if (status === 'approved') {
            const employee = await User.findById(leave.employee);
            if (employee?.leaveBalance && typeof employee.leaveBalance[leave.leaveType] === 'number') {
                employee.leaveBalance[leave.leaveType] = Math.max(
                    0,
                    employee.leaveBalance[leave.leaveType] - leave.numberOfDays
                );
                await employee.save();
            }
        }

        return res.json({ message: `Leave ${status}`, data: leave });
    } catch (error) {
        return res.status(500).json({ message: 'Failed to update leave request', error: error.message });
    }
};

module.exports = {
    createLeaveRequest,
    getMyLeaveRequests,
    getAllLeaveRequests,
    updateLeaveStatus
};
