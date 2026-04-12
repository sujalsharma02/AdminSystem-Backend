const User = require('../models/User');

// @desc    Get all employees
// @route   GET /api/employees
// @access  Admin
const getEmployees = async (req, res) => {
    try {
        const employees = await User.find({
            role: { $in: ['employee', 'manager', 'hr'] }
        }).sort({ createdAt: -1 });
        res.json(employees);
    } catch (error) {
        res.status(500).json({ message: error.message });
    }
};

// @desc    Create employee/hr account
// @route   POST /api/employees
// @access  Admin
const createEmployee = async (req, res) => {
    const { firstName, email, password, role, department } = req.body || {};

    if (!firstName || !email || !password || !role) {
        return res.status(400).json({ message: 'firstName, email, password and role are required' });
    }

    if (!['employee', 'hr'].includes(role)) {
        return res.status(400).json({ message: 'Role must be employee or hr' });
    }

    try {
        const exists = await User.findOne({ email });
        if (exists) {
            return res.status(409).json({ message: 'User with this email already exists' });
        }

        const user = await User.create({
            firstName,
            email,
            password,
            role,
            department: department || 'General'
        });

        return res.status(201).json({
            message: `${role.toUpperCase()} created`,
            data: {
                _id: user._id,
                firstName: user.firstName,
                email: user.email,
                role: user.role,
                department: user.department
            }
        });
    } catch (error) {
        return res.status(500).json({ message: error.message });
    }
};

module.exports = { getEmployees, createEmployee };
