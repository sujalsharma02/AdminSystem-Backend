const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    firstName: {
        type: String,
        required: true
    },
    email: {
        type: String,
        required: true,
        unique: true
    },
    password: {
        type: String,
        required: true
    },
    role: {
        type: String,
        enum: ['super_admin', 'admin', 'hr', 'manager', 'employee'],
        default: 'employee'
    },
    department: {
        type: String,
        default: 'General'
    },
    managerId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null
    },
    leaveBalance: {
        annual: { type: Number, default: 18 },
        sick: { type: Number, default: 10 },
        casual: { type: Number, default: 6 },
        unpaid: { type: Number, default: 0 }
    },
    tasks: [{
        taskTitle: String,
        taskDescription: String,
        taskDate: String,
        category: String,
        comments: [{
            text: { type: String, required: true, trim: true },
            authorName: { type: String, default: 'Admin' },
            authorRole: { type: String, default: 'admin' },
            createdAt: { type: Date, default: Date.now }
        }],
        active: { type: Boolean, default: false },
        newTask: { type: Boolean, default: true },
        completed: { type: Boolean, default: false },
        failed: { type: Boolean, default: false }
    }],
    taskCounts: {
        active: { type: Number, default: 0 },
        newTask: { type: Number, default: 0 },
        completed: { type: Number, default: 0 },
        failed: { type: Number, default: 0 }
    }
}, { timestamps: true });

// Encrypt password using bcrypt
userSchema.pre('save', async function () {
    if (!this.isModified('password')) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Match user entered password to hashed password in database
userSchema.methods.matchPassword = async function (enteredPassword) {
    return await bcrypt.compare(enteredPassword, this.password);
};

const User = mongoose.model('User', userSchema);

module.exports = User;
