const express = require('express');
const router = express.Router();
const {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getMyProducts,
    getRecommendedProducts,
    trackProductView,
    getRecentlyViewed,
} = require('../controllers/productController');
const { protect, optionalAuth } = require('../middleware/auth');
const upload = require('../middleware/upload');

// Public routes
router.get('/', getProducts);
router.get('/recommended', optionalAuth, getRecommendedProducts);

// Protected routes (must be before :id route)
router.get('/user/my', protect, getMyProducts);
router.get('/recently-viewed', protect, getRecentlyViewed);

// Single product route (must be after specific routes)
router.get('/:id', getProduct);

// Product CRUD
router.post('/', protect, upload.single('gambar'), createProduct);
router.put('/:id', protect, upload.single('gambar'), updateProduct);
router.delete('/:id', protect, deleteProduct);
router.post('/:id/view', protect, trackProductView);

module.exports = router;
