const jwt = require('jsonwebtoken');
const User = require('../models/User');

const protect = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            // Get token from header
            token = req.headers.authorization.split(' ')[1];

            // Verify token
            const decoded = jwt.verify(token, process.env.JWT_SECRET);

            // Get user from token
            req.user = await User.findById(decoded.id).select('-password');

            if (!req.user) {
                return res.status(401).json({
                    success: false,
                    message: 'User tidak ditemukan',
                });
            }

            // Check if user is banned
            if (req.user.isBanned) {
                return res.status(403).json({
                    success: false,
                    message: 'Akun Anda telah diblokir. Hubungi admin untuk informasi lebih lanjut.',
                });
            }

            next();
        } catch (error) {
            console.error(error);
            res.status(401).json({
                success: false,
                message: 'Token tidak valid',
            });
        }
    }

    if (!token) {
        res.status(401).json({
            success: false,
            message: 'Akses ditolak. Silakan login terlebih dahulu',
        });
    }
};

const adminOnly = (req, res, next) => {
    if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Akses ditolak. Fitur ini hanya untuk admin.',
        });
    }
};

// Super admin only middleware
const superAdminOnly = (req, res, next) => {
    if (req.user && req.user.role === 'super_admin') {
        next();
    } else {
        res.status(403).json({
            success: false,
            message: 'Akses ditolak. Fitur ini hanya untuk Super Admin.',
        });
    }
};

// Optional auth - doesn't require authentication but attaches user if token is valid
const optionalAuth = async (req, res, next) => {
    let token;

    if (
        req.headers.authorization &&
        req.headers.authorization.startsWith('Bearer')
    ) {
        try {
            token = req.headers.authorization.split(' ')[1];
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            req.user = await User.findById(decoded.id).select('-password');
        } catch {
            // Token invalid, continue without user
            req.user = null;
        }
    }

    next();
};

module.exports = { protect, adminOnly, superAdminOnly, optionalAuth };
