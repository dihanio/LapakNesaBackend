const Wishlist = require('../models/Wishlist');
const Product = require('../models/Product');

// @desc    Toggle wishlist (add/remove)
// @route   POST /api/wishlist/toggle
// @access  Private
const toggleWishlist = async (req, res) => {
    try {
        const { productId } = req.body;

        // Check if product exists
        const product = await Product.findById(productId);
        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        // Check if already in wishlist
        const existing = await Wishlist.findOne({
            user: req.user._id,
            product: productId
        });

        if (existing) {
            // Remove from wishlist
            await existing.deleteOne();
            return res.json({
                success: true,
                message: 'Produk dihapus dari wishlist',
                inWishlist: false,
            });
        } else {
            // Add to wishlist
            await Wishlist.create({
                user: req.user._id,
                product: productId
            });
            return res.json({
                success: true,
                message: 'Produk ditambahkan ke wishlist',
                inWishlist: true,
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get my wishlist
// @route   GET /api/wishlist
// @access  Private
const getMyWishlist = async (req, res) => {
    try {
        const wishlistItems = await Wishlist.find({ user: req.user._id })
            .populate({
                path: 'product',
                select: 'namaBarang harga gambar kondisi status lokasi penjual',
                populate: { path: 'penjual', select: 'nama fakultas avatar' }
            })
            .sort({ createdAt: -1 });

        // Filter out null products (deleted products)
        const validItems = wishlistItems.filter(item => item.product !== null);

        res.json({
            success: true,
            count: validItems.length,
            data: validItems.map(item => item.product),
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Check if product is in wishlist
// @route   GET /api/wishlist/check/:productId
// @access  Private
const checkWishlist = async (req, res) => {
    try {
        const exists = await Wishlist.findOne({
            user: req.user._id,
            product: req.params.productId
        });

        res.json({
            success: true,
            inWishlist: !!exists,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Remove from wishlist
// @route   DELETE /api/wishlist/:productId
// @access  Private
const removeFromWishlist = async (req, res) => {
    try {
        const result = await Wishlist.findOneAndDelete({
            user: req.user._id,
            product: req.params.productId
        });

        if (!result) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ada di wishlist',
            });
        }

        res.json({
            success: true,
            message: 'Produk dihapus dari wishlist',
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
    toggleWishlist,
    getMyWishlist,
    checkWishlist,
    removeFromWishlist,
};
