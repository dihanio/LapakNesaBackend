const express = require('express');
const router = express.Router();
const { protect, adminOnly, superAdminOnly } = require('../middleware/auth');
const {
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
    rejectProduct
} = require('../controllers/adminController');
const reportController = require('../controllers/reportController');
const bannerController = require('../controllers/bannerController');
const settingsController = require('../controllers/settingsController');

// Public debug route
router.get('/debug-verifications', getPendingVerifications);

// All routes are protected and admin only
router.use(protect, adminOnly);

// Dashboard
router.get('/stats', getDashboardStats);

// Analytics
router.get('/analytics', settingsController.getAnalytics);

// Settings (Super Admin only for write)
router.get('/settings', settingsController.getSettings);
router.put('/settings', superAdminOnly, settingsController.updateSettings);

// Verifications
router.get('/verifications', getPendingVerifications);
router.post('/verifications/:id/approve', approveSeller);
router.post('/verifications/:id/reject', rejectSeller);

// User management
router.get('/users', getAllUsers);
router.put('/users/:id/ban', toggleBanUser);
// Super Admin only routes
router.post('/users', superAdminOnly, require('../controllers/adminController').createAdmin);
router.put('/users/:id/role', superAdminOnly, updateUserRole);
router.delete('/users/:id', superAdminOnly, deleteUser);

// Product moderation
router.get('/products', getAllProducts);
router.get('/products/pending', getPendingProducts);
router.put('/products/:id/approve', approveProduct);
router.put('/products/:id/reject', rejectProduct);
router.delete('/products/:id', deleteProduct);

// Report management
router.get('/reports', reportController.getAllReports);
router.get('/reports/stats', reportController.getReportStats);
router.get('/reports/:id', reportController.getReportDetail);
router.put('/reports/:id', reportController.updateReport);
router.post('/reports/:id/resolve', reportController.resolveReport);

// Banner management
router.get('/banners', bannerController.getAllBanners);
router.post('/banners', bannerController.createBanner);
router.get('/banners/:id', bannerController.getBannerById);
router.put('/banners/:id', bannerController.updateBanner);
router.delete('/banners/:id', bannerController.deleteBanner);
router.put('/banners-reorder', bannerController.reorderBanners);

module.exports = router;

