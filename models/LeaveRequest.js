const mongoose = require('mongoose');

const leaveRequestSchema = new mongoose.Schema(
    {
        employee: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            required: true
        },
        leaveType: {
            type: String,
            enum: ['annual', 'sick', 'casual', 'unpaid'],
            required: true
        },
        fromDate: {
            type: Date,
            required: true
        },
        toDate: {
            type: Date,
            required: true
        },
        numberOfDays: {
            type: Number,
            required: true
        },
        reason: {
            type: String,
            required: true,
            trim: true,
            maxlength: 1000
        },
        status: {
            type: String,
            enum: ['pending', 'approved', 'rejected', 'cancelled'],
            default: 'pending'
        },
        approver: {
            type: mongoose.Schema.Types.ObjectId,
            ref: 'User',
            default: null
        },
        approverComment: {
            type: String,
            default: ''
        },
        aiSummary: {
            type: String,
            default: ''
        },
        aiRisk: {
            type: String,
            enum: ['low', 'medium', 'high'],
            default: 'low'
        }
    },
    { timestamps: true }
);

const LeaveRequest = mongoose.model('LeaveRequest', leaveRequestSchema);

module.exports = LeaveRequest;
