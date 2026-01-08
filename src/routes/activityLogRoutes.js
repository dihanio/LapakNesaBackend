const express = require('express');
const router = express.Router();
const activityLogController = require('../controllers/activityLogController');
const { protect, superAdminOnly } = require('../middleware/auth');

// All routes require super admin authentication (activity logs are super admin only)
router.use(protect);
router.use(superAdminOnly);

// Get activity logs with pagination and filters
router.get('/', activityLogController.getActivityLogs);

// Get recent activity logs for dashboard
router.get('/recent', activityLogController.getRecentLogs);

// Get activity statistics
router.get('/stats', activityLogController.getActivityStats);

// Get logs for a specific target
router.get('/target/:targetType/:targetId', activityLogController.getTargetLogs);

module.exports = router;
