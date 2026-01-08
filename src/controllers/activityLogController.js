const ActivityLog = require('../models/ActivityLog');

// Get activity logs (admin only)
exports.getActivityLogs = async (req, res) => {
    try {
        const {
            page = 1,
            limit = 20,
            category,
            action,
            userId,
            startDate,
            endDate,
        } = req.query;

        const query = {};

        if (category) query.category = category;
        if (action) query.action = action;
        if (userId) query.user = userId;

        // Date range filter
        if (startDate || endDate) {
            query.createdAt = {};
            if (startDate) query.createdAt.$gte = new Date(startDate);
            if (endDate) query.createdAt.$lte = new Date(endDate);
        }

        const skip = (parseInt(page) - 1) * parseInt(limit);

        const [logs, total] = await Promise.all([
            ActivityLog.find(query)
                .sort({ createdAt: -1 })
                .skip(skip)
                .limit(parseInt(limit))
                .populate('user', 'nama email avatar role')
                .lean(),
            ActivityLog.countDocuments(query),
        ]);

        res.json({
            success: true,
            data: logs,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / parseInt(limit)),
            },
        });
    } catch (error) {
        console.error('Get activity logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat activity logs',
        });
    }
};

// Get recent activity logs for dashboard
exports.getRecentLogs = async (req, res) => {
    try {
        const { limit = 10 } = req.query;

        const logs = await ActivityLog.find()
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('user', 'nama email avatar role')
            .lean();

        res.json({
            success: true,
            data: logs,
        });
    } catch (error) {
        console.error('Get recent logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat activity logs',
        });
    }
};

// Get activity stats
exports.getActivityStats = async (req, res) => {
    try {
        const today = new Date();
        today.setHours(0, 0, 0, 0);

        const [
            todayCount,
            categoryStats,
            recentActions,
        ] = await Promise.all([
            // Today's activity count
            ActivityLog.countDocuments({ createdAt: { $gte: today } }),
            
            // Stats by category
            ActivityLog.aggregate([
                {
                    $group: {
                        _id: '$category',
                        count: { $sum: 1 },
                    },
                },
            ]),
            
            // Most recent actions breakdown
            ActivityLog.aggregate([
                { $match: { createdAt: { $gte: new Date(Date.now() - 7 * 24 * 60 * 60 * 1000) } } },
                {
                    $group: {
                        _id: '$action',
                        count: { $sum: 1 },
                    },
                },
                { $sort: { count: -1 } },
                { $limit: 10 },
            ]),
        ]);

        res.json({
            success: true,
            data: {
                todayCount,
                categoryStats: categoryStats.reduce((acc, item) => {
                    acc[item._id] = item.count;
                    return acc;
                }, {}),
                recentActions,
            },
        });
    } catch (error) {
        console.error('Get activity stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat statistik aktivitas',
        });
    }
};

// Get activity logs for a specific target (product, user, etc.)
exports.getTargetLogs = async (req, res) => {
    try {
        const { targetType, targetId } = req.params;
        const { limit = 20 } = req.query;

        const logs = await ActivityLog.find({
            'target.type': targetType,
            'target.id': targetId,
        })
            .sort({ createdAt: -1 })
            .limit(parseInt(limit))
            .populate('user', 'nama email avatar role')
            .lean();

        res.json({
            success: true,
            data: logs,
        });
    } catch (error) {
        console.error('Get target logs error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memuat activity logs',
        });
    }
};
