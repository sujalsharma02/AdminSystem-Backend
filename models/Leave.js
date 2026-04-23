const mongoose = require('mongoose');

const leaveSchema = new mongoose.Schema({
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
        required: true,
        min: 1
    },
    reason: {
        type: String,
        required: true,
        trim: true
    },
    status: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending'
    },
    aiRisk: {
        type: String,
        enum: ['low', 'medium', 'high'],
        default: 'medium'
    },
    aiSummary: {
        type: String,
        default: ''
    },
    reviewedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    reviewDate: {
        type: Date,
        default: null
    },
    managerComment: {
        type: String,
        default: ''
    }
}, { timestamps: true });

module.exports = mongoose.model('Leave', leaveSchema);
