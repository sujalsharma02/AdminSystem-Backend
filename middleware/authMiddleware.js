const jwt = require('jsonwebtoken');
const User = require('../models/User');

const getTokenFromHeader = (req) => {
    const authHeader = req.headers.authorization || '';
    if (!authHeader.startsWith('Bearer ')) {
        return '';
    }

    return authHeader.slice(7).trim();
};

const authenticateToken = async (req, res, next) => {
    try {
        const token = getTokenFromHeader(req);
        if (!token) {
            return res.status(401).json({ message: 'Authorization token is required' });
        }

        const payload = jwt.verify(token, process.env.JWT_SECRET);
        const user = await User.findById(payload.id).select('-password');

        if (!user) {
            return res.status(401).json({ message: 'Invalid authorization token' });
        }

        req.user = user;
        next();
    } catch (error) {
        return res.status(401).json({ message: 'Authorization failed', error: error.message });
    }
};

const requireRoles = (...roles) => {
    return (req, res, next) => {
        if (!req.user) {
            return res.status(401).json({ message: 'Authorization required' });
        }

        if (!roles.includes(req.user.role)) {
            return res.status(403).json({ message: 'Insufficient permissions' });
        }

        return next();
    };
};

module.exports = { authenticateToken, requireRoles };
