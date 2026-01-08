const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const {
    toggleWishlist,
    getMyWishlist,
    checkWishlist,
    removeFromWishlist,
} = require('../controllers/wishlistController');

// All routes require authentication
router.use(protect);

router.post('/toggle', toggleWishlist);
router.get('/', getMyWishlist);
router.get('/check/:productId', checkWishlist);
router.delete('/:productId', removeFromWishlist);

module.exports = router;
