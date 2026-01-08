const Settings = require('../models/Settings');

const maintenanceMode = async (req, res, next) => {
    try {
        // Skip maintenance check for admin routes
        if (req.path.startsWith('/api/admin') || req.path.startsWith('/api/auth/login')) {
            return next();
        }

        // Check if user is admin (they should be able to access during maintenance)
        if (req.user && (req.user.role === 'admin' || req.user.role === 'super_admin')) {
            return next();
        }

        // Check maintenance mode setting
        const isMaintenanceMode = await Settings.get('maintenanceMode', false);

        if (isMaintenanceMode) {
            return res.status(503).json({
                success: false,
                maintenance: true,
                message: 'Situs sedang dalam pemeliharaan. Silakan coba lagi nanti.',
            });
        }

        next();
    } catch (error) {
        // If error checking settings, continue anyway
        console.error('Maintenance mode check error:', error);
        next();
    }
};

module.exports = maintenanceMode;
