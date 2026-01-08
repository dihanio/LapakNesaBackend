const Settings = require('../models/Settings');

// Default settings
const defaultSettings = {
    siteName: 'LapakNesa',
    siteDescription: 'Marketplace Mahasiswa Sumatera Utara',
    maintenanceMode: false,
    allowRegistration: true,
    allowSellerVerification: true,
    maxProductImages: 5,
    maxFileSize: 5,
    contactEmail: 'admin@lapaknesa.id',
    contactWhatsapp: '',
    primaryColor: '#0d59f2',
    enableNotifications: true,
};

// @desc    Get all settings
// @route   GET /api/admin/settings
// @access  Private/Admin
const getSettings = async (req, res) => {
    try {
        const savedSettings = await Settings.getAll();
        const settings = { ...defaultSettings, ...savedSettings };

        res.json({
            success: true,
            data: settings,
        });
    } catch (error) {
        console.error('Get settings error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil pengaturan',
        });
    }
};

// @desc    Update settings
// @route   PUT /api/admin/settings
// @access  Private/Admin
const updateSettings = async (req, res) => {
    try {
        const updates = req.body;
        const allowedKeys = Object.keys(defaultSettings);

        const promises = [];
        for (const key of Object.keys(updates)) {
            if (allowedKeys.includes(key)) {
                promises.push(Settings.set(key, updates[key], req.user._id));
            }
        }

        await Promise.all(promises);

        const savedSettings = await Settings.getAll();
        const settings = { ...defaultSettings, ...savedSettings };

        res.json({
            success: true,
            message: 'Pengaturan berhasil disimpan',
            data: settings,
        });
    } catch (error) {
        console.error('Update settings error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal menyimpan pengaturan',
        });
    }
};

// @desc    Get analytics data
// @route   GET /api/admin/analytics
// @access  Private/Admin
const getAnalytics = async (req, res) => {
    try {
        const User = require('../models/User');
        const Product = require('../models/Product');
        const Report = require('../models/Report');

        const { range = '7d' } = req.query;

        // Calculate date range
        let daysAgo;
        switch (range) {
            case '30d': daysAgo = 30; break;
            case '90d': daysAgo = 90; break;
            case '1y': daysAgo = 365; break;
            default: daysAgo = 7;
        }

        const startDate = new Date();
        startDate.setDate(startDate.getDate() - daysAgo);

        const previousStartDate = new Date(startDate);
        previousStartDate.setDate(previousStartDate.getDate() - daysAgo);

        // Current period stats
        const totalUsers = await User.countDocuments({ role: { $nin: ['admin', 'super_admin'] } });
        const totalProducts = await Product.countDocuments();
        const totalSoldProducts = await Product.countDocuments({ status: 'terjual' });
        const totalReports = await Report.countDocuments();

        // Period stats
        const newUsersCurrentPeriod = await User.countDocuments({
            createdAt: { $gte: startDate },
            role: { $nin: ['admin', 'super_admin'] }
        });
        const newUsersPreviousPeriod = await User.countDocuments({
            createdAt: { $gte: previousStartDate, $lt: startDate },
            role: { $nin: ['admin', 'super_admin'] }
        });

        const newProductsCurrentPeriod = await Product.countDocuments({
            createdAt: { $gte: startDate }
        });
        const newProductsPreviousPeriod = await Product.countDocuments({
            createdAt: { $gte: previousStartDate, $lt: startDate }
        });

        // Calculate growth percentages
        const userGrowth = newUsersPreviousPeriod > 0
            ? Math.round(((newUsersCurrentPeriod - newUsersPreviousPeriod) / newUsersPreviousPeriod) * 100)
            : newUsersCurrentPeriod > 0 ? 100 : 0;

        const productGrowth = newProductsPreviousPeriod > 0
            ? Math.round(((newProductsCurrentPeriod - newProductsPreviousPeriod) / newProductsPreviousPeriod) * 100)
            : newProductsCurrentPeriod > 0 ? 100 : 0;

        // User growth chart data
        const userGrowthChart = await User.aggregate([
            { $match: { createdAt: { $gte: startDate }, role: { $nin: ['admin', 'super_admin'] } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Product growth chart data
        const productGrowthChart = await Product.aggregate([
            { $match: { createdAt: { $gte: startDate } } },
            { $group: { _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } }, count: { $sum: 1 } } },
            { $sort: { _id: 1 } }
        ]);

        // Products by category
        const productsByCategory = await Product.aggregate([
            { $group: { _id: "$kategori", count: { $sum: 1 } } },
            { $sort: { count: -1 } }
        ]);

        // Users by role
        const usersByRole = await User.aggregate([
            { $match: { role: { $nin: ['admin', 'super_admin'] } } },
            { $group: { _id: "$role", count: { $sum: 1 } } }
        ]);

        // Top sellers
        const topSellers = await Product.aggregate([
            { $group: { _id: "$penjual", productCount: { $sum: 1 } } },
            { $sort: { productCount: -1 } },
            { $limit: 5 },
            { $lookup: { from: 'users', localField: '_id', foreignField: '_id', as: 'seller' } },
            { $unwind: '$seller' },
            { $project: { nama: '$seller.nama', avatar: '$seller.avatar', productCount: 1 } }
        ]);

        // Revenue (from sold products)
        const soldProducts = await Product.find({ status: 'terjual' }).select('harga');
        const totalRevenue = soldProducts.reduce((acc, curr) => acc + (curr.harga || 0), 0);

        res.json({
            success: true,
            data: {
                summary: {
                    totalUsers,
                    totalProducts,
                    totalSoldProducts,
                    totalReports,
                    totalRevenue,
                },
                growth: {
                    users: userGrowth,
                    products: productGrowth,
                    usersNew: newUsersCurrentPeriod,
                    productsNew: newProductsCurrentPeriod,
                },
                charts: {
                    userGrowth: userGrowthChart,
                    productGrowth: productGrowthChart,
                    productsByCategory,
                    usersByRole,
                },
                topSellers,
                range,
            }
        });
    } catch (error) {
        console.error('Get analytics error:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil data analitik',
        });
    }
};

module.exports = {
    getSettings,
    updateSettings,
    getAnalytics,
};
