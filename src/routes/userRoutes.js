const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const User = require('../models/User');
const Product = require('../models/Product');

// @route   POST /api/users/:id/follow
// @desc    Follow a user/seller
// @access  Private
router.post('/:id/follow', protect, async (req, res) => {
    try {
        const userToFollow = await User.findById(req.params.id);

        if (!userToFollow) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        // Can't follow yourself
        if (userToFollow._id.toString() === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Tidak bisa mengikuti diri sendiri',
            });
        }

        // Check if already following
        if (req.user.following?.includes(userToFollow._id)) {
            return res.status(400).json({
                success: false,
                message: 'Anda sudah mengikuti user ini',
            });
        }

        // Add to following list
        await User.findByIdAndUpdate(req.user._id, {
            $addToSet: { following: userToFollow._id },
            $inc: { followingCount: 1 }
        });

        // Add to followers list
        await User.findByIdAndUpdate(userToFollow._id, {
            $addToSet: { followers: req.user._id },
            $inc: { followersCount: 1 }
        });

        res.json({
            success: true,
            message: `Berhasil mengikuti ${userToFollow.nama}`,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengikuti user',
        });
    }
});

// @route   DELETE /api/users/:id/follow
// @desc    Unfollow a user/seller
// @access  Private
router.delete('/:id/follow', protect, async (req, res) => {
    try {
        const userToUnfollow = await User.findById(req.params.id);

        if (!userToUnfollow) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        // Check if actually following
        if (!req.user.following?.includes(userToUnfollow._id)) {
            return res.status(400).json({
                success: false,
                message: 'Anda tidak mengikuti user ini',
            });
        }

        // Remove from following list
        await User.findByIdAndUpdate(req.user._id, {
            $pull: { following: userToUnfollow._id },
            $inc: { followingCount: -1 }
        });

        // Remove from followers list
        await User.findByIdAndUpdate(userToUnfollow._id, {
            $pull: { followers: req.user._id },
            $inc: { followersCount: -1 }
        });

        res.json({
            success: true,
            message: `Berhenti mengikuti ${userToUnfollow.nama}`,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal berhenti mengikuti',
        });
    }
});

// @route   GET /api/users/:id/followers
// @desc    Get user's followers list
// @access  Public
router.get('/:id/followers', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('followers', 'nama avatar fakultas followersCount');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        res.json({
            success: true,
            data: {
                count: user.followersCount || 0,
                followers: user.followers || [],
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil followers',
        });
    }
});

// @route   GET /api/users/:id/following
// @desc    Get user's following list
// @access  Public
router.get('/:id/following', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .populate('following', 'nama avatar fakultas followersCount');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        res.json({
            success: true,
            data: {
                count: user.followingCount || 0,
                following: user.following || [],
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil following',
        });
    }
});

// @route   GET /api/users/:id
// @desc    Get user profile
// @access  Public
router.get('/:id', async (req, res) => {
    try {
        const user = await User.findById(req.params.id)
            .select('nama avatar fakultas role followersCount followingCount createdAt verification');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        // Get product count
        const productCount = await Product.countDocuments({
            penjual: user._id,
            status: 'tersedia'
        });

        res.json({
            success: true,
            data: {
                ...user.toObject(),
                productCount,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil profil',
        });
    }
});

// @route   GET /api/users/me/following/check/:id
// @desc    Check if current user is following a specific user
// @access  Private
router.get('/me/following/check/:id', protect, async (req, res) => {
    try {
        const isFollowing = req.user.following?.includes(req.params.id) || false;

        res.json({
            success: true,
            data: { isFollowing },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengecek status follow',
        });
    }
});

// @route   GET /api/users/feed
// @desc    Get products from followed sellers
// @access  Private
router.get('/feed/products', protect, async (req, res) => {
    try {
        const { page = 1, limit = 12 } = req.query;
        const pageNum = parseInt(page, 10);
        const limitNum = parseInt(limit, 10);
        const skip = (pageNum - 1) * limitNum;

        // Get user's following list
        const user = await User.findById(req.user._id);
        const followingIds = user.following || [];

        if (followingIds.length === 0) {
            return res.json({
                success: true,
                data: [],
                pagination: { page: pageNum, limit: limitNum, total: 0, totalPages: 0 }
            });
        }

        // Get products from followed sellers
        const total = await Product.countDocuments({
            penjual: { $in: followingIds },
            status: 'tersedia'
        });

        const products = await Product.find({
            penjual: { $in: followingIds },
            status: 'tersedia'
        })
            .populate('penjual', 'nama avatar fakultas')
            .sort({ createdAt: -1 })
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages: Math.ceil(total / limitNum)
            }
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil feed',
        });
    }
});

module.exports = router;
