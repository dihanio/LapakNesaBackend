const Report = require('../models/Report');
const Product = require('../models/Product');
const User = require('../models/User');
const cloudinary = require('../config/cloudinary');

// Create a new report
exports.createReport = async (req, res) => {
    try {
        const { type, targetProductId, targetUserId, category, subject, description, evidence } = req.body;

        // Validate type-specific requirements
        if (type === 'product' && !targetProductId) {
            return res.status(400).json({
                success: false,
                message: 'ID produk yang dilaporkan wajib diisi',
            });
        }

        if (type === 'user' && !targetUserId) {
            return res.status(400).json({
                success: false,
                message: 'ID pengguna yang dilaporkan wajib diisi',
            });
        }

        // Verify target exists
        if (targetProductId) {
            const product = await Product.findById(targetProductId);
            if (!product) {
                return res.status(404).json({
                    success: false,
                    message: 'Produk tidak ditemukan',
                });
            }
        }

        if (targetUserId) {
            const user = await User.findById(targetUserId);
            if (!user) {
                return res.status(404).json({
                    success: false,
                    message: 'Pengguna tidak ditemukan',
                });
            }

            // Cannot report yourself
            if (targetUserId === req.user._id.toString()) {
                return res.status(400).json({
                    success: false,
                    message: 'Tidak bisa melaporkan diri sendiri',
                });
            }
        }

        // Handle evidence upload (base64 images)
        let evidenceUrls = [];
        if (evidence && evidence.length > 0) {
            for (const image of evidence.slice(0, 3)) { // Max 3 images
                if (image.startsWith('data:image')) {
                    try {
                        const result = await cloudinary.uploader.upload(image, {
                            folder: 'lapaknesa/reports',
                            transformation: [
                                { width: 1200, height: 1200, crop: 'limit' },
                                { quality: 'auto' },
                            ],
                        });
                        evidenceUrls.push(result.secure_url);
                    } catch (uploadError) {
                        console.error('Evidence upload error:', uploadError);
                        // Continue even if one image fails, or you could return error
                    }
                }
            }
        }

        // Determine priority based on category
        let priority = 'medium';
        if (['penipuan', 'pelecehan'].includes(category)) {
            priority = 'high';
        } else if (['saran', 'pertanyaan'].includes(category)) {
            priority = 'low';
        }

        const report = await Report.create({
            reporter: req.user._id,
            type,
            targetProduct: targetProductId || null,
            targetUser: targetUserId || null,
            category,
            subject,
            description,
            evidence: evidenceUrls,
            priority,
        });

        await report.populate('reporter', 'nama email avatar');

        res.status(201).json({
            success: true,
            message: 'Laporan berhasil dikirim',
            data: report,
        });
    } catch (error) {
        console.error('Create report error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal membuat laporan',
            error: process.env.NODE_ENV === 'development' ? error.message : undefined,
        });
    }
};

// Get my reports
exports.getMyReports = async (req, res) => {
    try {
        const { status, page = 1, limit = 10 } = req.query;

        const query = { reporter: req.user._id };
        if (status) {
            query.status = status;
        }

        const reports = await Report.find(query)
            .sort({ createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('targetProduct', 'namaBarang gambar')
            .populate('targetUser', 'nama avatar');

        const total = await Report.countDocuments(query);

        res.json({
            success: true,
            data: reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
        });
    } catch (error) {
        console.error('Get my reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil laporan',
        });
    }
};

// Get single report detail
exports.getReportDetail = async (req, res) => {
    try {
        const report = await Report.findById(req.params.id)
            .populate('reporter', 'nama email avatar')
            .populate('targetProduct', 'namaBarang gambar harga penjual')
            .populate('targetUser', 'nama email avatar fakultas')
            .populate('assignedTo', 'nama')
            .populate('resolvedBy', 'nama');

        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Laporan tidak ditemukan',
            });
        }

        // Only reporter or admin can view
        if (report.reporter._id.toString() !== req.user._id.toString() && req.user.role !== 'admin') {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses',
            });
        }

        res.json({
            success: true,
            data: report,
        });
    } catch (error) {
        console.error('Get report detail error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil detail laporan',
        });
    }
};

// ============ ADMIN FUNCTIONS ============

// Get all reports (admin)
exports.getAllReports = async (req, res) => {
    try {
        const { status, type, priority, category, page = 1, limit = 20, search } = req.query;

        const query = {};

        if (status) query.status = status;
        if (type) query.type = type;
        if (priority) query.priority = priority;
        if (category) query.category = category;
        if (search) {
            query.$or = [
                { ticketNumber: { $regex: search, $options: 'i' } },
                { subject: { $regex: search, $options: 'i' } },
            ];
        }

        const reports = await Report.find(query)
            .sort({ priority: -1, createdAt: -1 })
            .skip((page - 1) * limit)
            .limit(parseInt(limit))
            .populate('reporter', 'nama email avatar')
            .populate('targetProduct', 'namaBarang gambar')
            .populate('targetUser', 'nama avatar')
            .populate('assignedTo', 'nama');

        const total = await Report.countDocuments(query);

        // Get counts by status
        const statusCounts = await Report.aggregate([
            { $group: { _id: '$status', count: { $sum: 1 } } }
        ]);

        res.json({
            success: true,
            data: reports,
            pagination: {
                page: parseInt(page),
                limit: parseInt(limit),
                total,
                pages: Math.ceil(total / limit),
            },
            statusCounts: statusCounts.reduce((acc, curr) => {
                acc[curr._id] = curr.count;
                return acc;
            }, {}),
        });
    } catch (error) {
        console.error('Get all reports error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil daftar laporan',
        });
    }
};

// Update report (admin)
exports.updateReport = async (req, res) => {
    try {
        const { status, priority, adminNotes, assignedTo } = req.body;

        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Laporan tidak ditemukan',
            });
        }

        // Update fields
        if (status) {
            report.status = status;
            if (status === 'in_progress') {
                report.inProgressAt = new Date();
            } else if (status === 'closed') {
                report.closedAt = new Date();
            }
        }
        if (priority) report.priority = priority;
        if (adminNotes !== undefined) report.adminNotes = adminNotes;
        if (assignedTo !== undefined) report.assignedTo = assignedTo || null;

        await report.save();

        await report.populate('reporter', 'nama email avatar');
        await report.populate('assignedTo', 'nama');

        res.json({
            success: true,
            message: 'Laporan berhasil diperbarui',
            data: report,
        });
    } catch (error) {
        console.error('Update report error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal memperbarui laporan',
        });
    }
};

// Resolve report (admin)
exports.resolveReport = async (req, res) => {
    try {
        const { resolution } = req.body;

        if (!resolution) {
            return res.status(400).json({
                success: false,
                message: 'Resolusi wajib diisi',
            });
        }

        const report = await Report.findById(req.params.id);
        if (!report) {
            return res.status(404).json({
                success: false,
                message: 'Laporan tidak ditemukan',
            });
        }

        report.status = 'resolved';
        report.resolution = resolution;
        report.resolvedBy = req.user._id;
        report.resolvedAt = new Date();

        await report.save();

        await report.populate('reporter', 'nama email avatar');
        await report.populate('resolvedBy', 'nama');

        res.json({
            success: true,
            message: 'Laporan berhasil diselesaikan',
            data: report,
        });
    } catch (error) {
        console.error('Resolve report error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menyelesaikan laporan',
        });
    }
};

// Get report statistics (admin dashboard)
exports.getReportStats = async (req, res) => {
    try {
        const stats = await Report.aggregate([
            {
                $facet: {
                    byStatus: [
                        { $group: { _id: '$status', count: { $sum: 1 } } }
                    ],
                    byType: [
                        { $group: { _id: '$type', count: { $sum: 1 } } }
                    ],
                    byCategory: [
                        { $group: { _id: '$category', count: { $sum: 1 } } }
                    ],
                    byPriority: [
                        { $group: { _id: '$priority', count: { $sum: 1 } } }
                    ],
                    recentReports: [
                        { $sort: { createdAt: -1 } },
                        { $limit: 5 },
                        { $project: { ticketNumber: 1, subject: 1, status: 1, priority: 1, createdAt: 1 } }
                    ],
                    total: [
                        { $count: 'count' }
                    ]
                }
            }
        ]);

        res.json({
            success: true,
            data: {
                byStatus: stats[0].byStatus.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {}),
                byType: stats[0].byType.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {}),
                byCategory: stats[0].byCategory.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {}),
                byPriority: stats[0].byPriority.reduce((acc, curr) => { acc[curr._id] = curr.count; return acc; }, {}),
                recentReports: stats[0].recentReports,
                total: stats[0].total[0]?.count || 0,
            },
        });
    } catch (error) {
        console.error('Get report stats error:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil statistik laporan',
        });
    }
};
