const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    const authHeader = req.headers.authorization || '';
    const token = authHeader.startsWith('Bearer ') ? authHeader.split(' ')[1] : null;

    if (!token) {
        return res.status(401).json({ message: 'Not authorized, token missing' });
    }

    try {
        const decoded = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(decoded.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Not authorized, user not found' });
        }

        req.user = user;
        return next();
    } catch (error) {
        return res.status(401).json({ message: 'Not authorized, token invalid' });
    }
};

const authorizeRoles = (...allowedRoles) => {
    return (req, res, next) => {
        const role = req.user?.role;

        if (!role || !allowedRoles.includes(role)) {
            return res.status(403).json({ message: 'Forbidden: insufficient role' });
        }

        return next();
    };
};

module.exports = {
    protect,
    authorizeRoles
};
