const User = require('../models/User');
const Report = require('../models/Report');
const activityLogService = require('../services/activityLogService');

// @desc    Get pending seller requests
// @route   GET /api/admin/verifications
// @access  Private/Admin
const getPendingVerifications = async (req, res) => {
    try {
        const users = await User.find({ 'verification.status': 'pending' })
            .select('nama email nim fakultas verification avatar');

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        const startOfMonth = new Date();
        startOfMonth.setDate(1);
        startOfMonth.setHours(0, 0, 0, 0);

        const approvedToday = await User.countDocuments({
            'verification.status': 'verified',
            'verification.verifiedAt': { $gte: startOfToday },
            role: 'penjual'
        });

        const rejectedMonth = await User.countDocuments({
            'verification.status': 'rejected',
            'verification.rejectedAt': { $gte: startOfMonth },
            role: { $nin: ['admin', 'super_admin'] }
        });

        res.json({
            success: true,
            count: users.length,
            data: users,
            stats: {
                approvedToday,
                rejectedMonth
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Approve seller request
// @route   POST /api/admin/verifications/:id/approve
// @access  Private/Admin
const approveSeller = async (req, res) => {
    try {
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        if (user.verification.status !== 'pending') {
            return res.status(400).json({
                success: false,
                message: 'User tidak dalam status menunggu verifikasi',
            });
        }

        user.role = 'penjual';
        user.verification.status = 'verified';
        user.verification.verifiedAt = new Date();
        await user.save();

        // Log verification approval
        await activityLogService.logVerificationApproved(
            req.user._id,
            req.user.role,
            user._id,
            { nama: user.nama, email: user.email },
            req
        );

        res.json({
            success: true,
            message: 'User berhasil diverifikasi menjadi Penjual',
            data: user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Reject seller request
// @route   POST /api/admin/verifications/:id/reject
// @access  Private/Admin
const rejectSeller = async (req, res) => {
    try {
        const { reason } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        user.verification.status = 'rejected';
        user.verification.status = 'rejected';
        user.verification.notes = reason || 'Data tidak valid';
        user.verification.rejectedAt = new Date();
        // Note: ktmImage is not deleted, maybe needed for audit? Or should delete?
        // Let's keep it simple.
        await user.save();

        // Log verification rejection
        await activityLogService.logVerificationRejected(
            req.user._id,
            req.user.role,
            user._id,
            { nama: user.nama, email: user.email, reason: reason || 'Data tidak valid' },
            req
        );

        res.json({
            success: true,
            message: 'Pengajuan ditolak',
            data: user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get dashboard statistics
// @route   GET /api/admin/stats
// @access  Private/Admin
const getDashboardStats = async (req, res) => {
    try {
        const Product = require('../models/Product');

        // 1. User Stats
        const totalUsers = await User.countDocuments({ role: { $nin: ['admin', 'super_admin'] } });
        const newUsers = await User.countDocuments({
            createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
        });
        const totalSellers = await User.countDocuments({ role: 'penjual' });
        const totalBuyers = await User.countDocuments({ role: 'pembeli' });
        const bannedUsers = await User.countDocuments({ isBanned: true });

        // Online users (active in last 5 minutes)
        const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000);
        const onlineUsers = await User.countDocuments({
            role: { $nin: ['admin', 'super_admin'] },
            $or: [
                { isOnline: true },
                { lastActive: { $gte: fiveMinutesAgo } }
            ]
        });

        // 2. Product Stats
        const totalProducts = await Product.countDocuments();
        const newProducts = await Product.countDocuments({
            createdAt: { $gte: new Date(new Date().setDate(new Date().getDate() - 30)) }
        });
        const totalSoldProducts = await Product.countDocuments({ status: 'terjual' });

        // 3. Revenue Stats (Approximate from sold products)
        const soldProducts = await Product.find({ status: 'terjual' }).select('harga');
        const totalRevenue = soldProducts.reduce((acc, curr) => acc + curr.harga, 0);

        // 4. Pending Actions (Tasks)
        const pendingVerifications = await User.find({ 'verification.status': 'pending' })
            .select('nama verification.submittedAt')
            .limit(5);

        // 4b. Pending Products for approval
        const pendingProductsCount = await Product.countDocuments({ approvalStatus: 'pending' });

        // 4c. Open Reports count
        const openReportsCount = await Report.countDocuments({ status: { $in: ['open', 'in_progress'] } });
        const resolvedReportsCount = await Report.countDocuments({ status: 'resolved' });

        // 5. Recent Transactions (Sold Products)
        const recentTransactions = await Product.find({ status: 'terjual' })
            .populate('penjual', 'nama fakultas')
            .sort({ updatedAt: -1 })
            .limit(5);

        // 6. Chart Data (Users joined last 7 days)
        const sevenDaysAgo = new Date();
        sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);

        // Aggregate daily user counts
        const userGrowth = await User.aggregate([
            { $match: { createdAt: { $gte: sevenDaysAgo } } },
            {
                $group: {
                    _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
                    count: { $sum: 1 }
                }
            },
            { $sort: { _id: 1 } }
        ]);

        res.json({
            success: true,
            data: {
                users: {
                    total: totalUsers,
                    new: newUsers,
                    online: onlineUsers,
                    sellers: totalSellers,
                    buyers: totalBuyers,
                    banned: bannedUsers
                },
                products: {
                    total: totalProducts,
                    new: newProducts,
                    sold: totalSoldProducts
                },
                revenue: { total: totalRevenue },
                pending: {
                    verifications: pendingVerifications.length,
                    products: pendingProductsCount,
                    reports: openReportsCount,
                    resolvedReports: resolvedReportsCount,
                    list: pendingVerifications
                },
                transactions: recentTransactions,
                chart: userGrowth
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Delete any product (admin moderation)
// @route   DELETE /api/admin/products/:id
// @access  Private/Admin
const deleteProduct = async (req, res) => {
    try {
        const Product = require('../models/Product');
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        // Store product info before deletion for logging
        const productInfo = { namaBarang: product.namaBarang, kategori: product.kategori, penjual: product.penjual };

        await product.deleteOne();

        // Log admin product deletion
        await activityLogService.logProductDeleted(
            req.user._id,
            req.user.role,
            req.params.id,
            { ...productInfo, deletedByAdmin: true },
            req
        );

        res.json({
            success: true,
            message: 'Produk berhasil dihapus oleh admin',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get all users (admin)
// @route   GET /api/admin/users
// @access  Private/Admin
const getAllUsers = async (req, res) => {
    try {
        const { page = 1, limit = 20, role, search } = req.query;

        let query = { role: { $ne: 'admin' } }; // Exclude admins

        if (role) {
            query.role = role;
        }

        if (search) {
            query.$or = [
                { nama: { $regex: search, $options: 'i' } },
                { email: { $regex: search, $options: 'i' } },
                { nim: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;

        const total = await User.countDocuments(query);
        const users = await User.find(query)
            .select('-password')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            count: users.length,
            data: users,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Ban/Unban user
// @route   PUT /api/admin/users/:id/ban
// @access  Private/Admin
// Note: Regular admin can only ban users with existing reports against them
const toggleBanUser = async (req, res) => {
    try {
        const { reportId } = req.body; // Optional: link to a report
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        if (user.role === 'admin' || user.role === 'super_admin') {
            return res.status(400).json({
                success: false,
                message: 'Tidak bisa ban admin lain',
            });
        }

        // For regular admin (not super_admin), require a report exists against this user
        if (req.user.role === 'admin') {
            // Check if there's any report against this user (as seller or reported user)
            const hasReport = await Report.findOne({
                $or: [
                    { reportedUser: user._id },
                    { 'reportedProduct.penjual': user._id }
                ],
                status: { $in: ['open', 'in_progress'] } // Only active reports count
            });

            if (!hasReport && !user.isBanned) {
                return res.status(403).json({
                    success: false,
                    message: 'Admin hanya bisa ban user yang memiliki laporan aktif. Gunakan menu Laporan Tiket untuk ban user.',
                });
            }
        }

        user.isBanned = !user.isBanned;
        await user.save();

        // If reportId provided, update the report status
        if (reportId && user.isBanned) {
            await Report.findByIdAndUpdate(reportId, {
                status: 'resolved',
                adminNotes: `User dibanned oleh ${req.user.nama}`,
                resolvedAt: new Date(),
                resolvedBy: req.user._id
            });
        }

        // Log ban/unban action
        if (user.isBanned) {
            await activityLogService.logUserBanned(
                req.user._id,
                req.user.role,
                user._id,
                { nama: user.nama, email: user.email, reportId },
                req
            );
        } else {
            await activityLogService.logUserUnbanned(
                req.user._id,
                req.user.role,
                user._id,
                { nama: user.nama, email: user.email },
                req
            );
        }

        res.json({
            success: true,
            message: user.isBanned ? 'User berhasil dibanned' : 'User berhasil di-unbanned',
            data: user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get all products (admin)
// @route   GET /api/admin/products
// @access  Private/Admin
const getAllProducts = async (req, res) => {
    try {
        const Product = require('../models/Product');
        const { page = 1, limit = 20, status, kategori, search } = req.query;

        let query = {};

        if (status) {
            query.status = status;
        }

        if (kategori) {
            query.kategori = kategori;
        }

        if (search) {
            query.$or = [
                { namaBarang: { $regex: search, $options: 'i' } },
                { deskripsi: { $regex: search, $options: 'i' } }
            ];
        }

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;

        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .populate('penjual', 'nama email fakultas nim avatar')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            count: products.length,
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Update user role
// @route   PUT /api/admin/users/:id/role
// @access  Private/Admin
const updateUserRole = async (req, res) => {
    try {
        const { role } = req.body;
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        if (user.role === 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Tidak bisa mengubah role admin lain',
            });
        }

        if (!['pembeli', 'penjual'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Role tidak valid. Gunakan: pembeli atau penjual',
            });
        }

        // If downgrading from penjual to pembeli, also reset verification
        if (user.role === 'penjual' && role === 'pembeli') {
            user.verification.status = 'none';
        }

        // If upgrading to penjual, auto-verify
        if (role === 'penjual' && user.verification.status !== 'verified') {
            user.verification.status = 'verified';
            user.verification.verifiedAt = new Date();
        }

        const oldRole = user.role;
        user.role = role;
        await user.save();

        // Log role change
        await activityLogService.logUserRoleChanged(
            req.user._id,
            req.user.role,
            user._id,
            { nama: user.nama, email: user.email, oldRole, newRole: role },
            req
        );

        res.json({
            success: true,
            message: `Role user berhasil diubah menjadi ${role}`,
            data: user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Delete user (soft or hard delete)
// @route   DELETE /api/admin/users/:id
// @access  Private/Admin
const deleteUser = async (req, res) => {
    try {
        const Product = require('../models/Product');
        const user = await User.findById(req.params.id);

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        if (user.role === 'admin') {
            return res.status(400).json({
                success: false,
                message: 'Tidak bisa menghapus admin lain',
            });
        }

        // Count user's products
        const productCount = await Product.countDocuments({ penjual: user._id });

        // Store user info before deletion for logging
        const userInfo = { nama: user.nama, email: user.email, role: user.role, productCount };

        // Delete user's products first
        if (productCount > 0) {
            await Product.deleteMany({ penjual: user._id });
        }

        // Delete the user
        await user.deleteOne();

        // Log user deletion
        await activityLogService.logUserDeleted(
            req.user._id,
            req.user.role,
            req.params.id,
            userInfo,
            req
        );

        res.json({
            success: true,
            message: `User dan ${productCount} produknya berhasil dihapus`,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get pending products for approval
// @route   GET /api/admin/products/pending
// @access  Private/Admin
const getPendingProducts = async (req, res) => {
    try {
        const Product = require('../models/Product');
        const { page = 1, limit = 20 } = req.query;

        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 20;
        const skip = (pageNum - 1) * limitNum;

        const query = { approvalStatus: 'pending' };
        const total = await Product.countDocuments(query);
        const products = await Product.find(query)
            .populate('penjual', 'nama email fakultas nim avatar verification')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            count: products.length,
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Approve product
// @route   PUT /api/admin/products/:id/approve
// @access  Private/Admin
const approveProduct = async (req, res) => {
    try {
        const Product = require('../models/Product');
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        if (product.approvalStatus === 'approved') {
            return res.status(400).json({
                success: false,
                message: 'Produk sudah disetujui sebelumnya',
            });
        }

        product.approvalStatus = 'approved';
        product.approvedAt = new Date();
        product.approvedBy = req.user._id;
        product.approvalNotes = null;
        await product.save();

        // Log product approval
        await activityLogService.logProductApproved(
            req.user._id,
            req.user.role,
            product._id,
            { namaBarang: product.namaBarang, kategori: product.kategori, penjual: product.penjual },
            req
        );

        res.json({
            success: true,
            message: 'Produk berhasil disetujui',
            data: product,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Reject product
// @route   PUT /api/admin/products/:id/reject
// @access  Private/Admin
const rejectProduct = async (req, res) => {
    try {
        const Product = require('../models/Product');
        const { reason } = req.body;
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        product.approvalStatus = 'rejected';
        product.approvalNotes = reason || 'Tidak memenuhi ketentuan';
        await product.save();

        // Log product rejection
        await activityLogService.logProductRejected(
            req.user._id,
            req.user.role,
            product._id,
            { namaBarang: product.namaBarang, kategori: product.kategori, penjual: product.penjual, reason: reason || 'Tidak memenuhi ketentuan' },
            req
        );

        res.json({
            success: true,
            message: 'Produk ditolak',
            data: product,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Create admin user (Super Admin only)
// @route   POST /api/admin/users
// @access  Private/SuperAdmin
const createAdmin = async (req, res) => {
    try {
        const { nama, email, password, role } = req.body;

        // Validate required fields
        if (!nama || !email || !password) {
            return res.status(400).json({
                success: false,
                message: 'Nama, email, dan password wajib diisi',
            });
        }

        // Only allow admin role to be created
        if (role && !['admin'].includes(role)) {
            return res.status(400).json({
                success: false,
                message: 'Hanya bisa membuat user dengan role admin',
            });
        }

        // Check if email already exists
        const existingUser = await User.findOne({ email: email.toLowerCase() });
        if (existingUser) {
            return res.status(400).json({
                success: false,
                message: 'Email sudah terdaftar',
            });
        }

        // Create admin user
        const bcrypt = require('bcryptjs');
        const hashedPassword = await bcrypt.hash(password, 10);

        const newAdmin = await User.create({
            nama,
            email: email.toLowerCase(),
            password: hashedPassword,
            role: 'admin',
            isVerified: true,
        });

        // Log admin creation
        await activityLogService.log(
            req.user._id,
            req.user.role,
            'create',
            'user',
            newAdmin._id,
            { nama: newAdmin.nama, email: newAdmin.email, role: 'admin' },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Admin berhasil dibuat',
            data: {
                _id: newAdmin._id,
                nama: newAdmin.nama,
                email: newAdmin.email,
                role: newAdmin.role,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

module.exports = {
    getPendingVerifications,
    approveSeller,
    rejectSeller,
    getDashboardStats,
    deleteProduct,
    getAllUsers,
    toggleBanUser,
    getAllProducts,
    updateUserRole,
    deleteUser,
    getPendingProducts,
    approveProduct,
    rejectProduct,
    createAdmin,
};
