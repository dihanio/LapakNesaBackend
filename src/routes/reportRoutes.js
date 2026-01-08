const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const reportController = require('../controllers/reportController');

// All routes require authentication
router.use(protect);

// User routes - Order matters! Specific routes before parameterized routes
router.get('/my', reportController.getMyReports);
router.post('/', reportController.createReport);
router.get('/:id', reportController.getReportDetail);

module.exports = router;
