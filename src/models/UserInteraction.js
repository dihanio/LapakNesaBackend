const mongoose = require('mongoose');

const userInteractionSchema = new mongoose.Schema({
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        required: true,
    },
    type: {
        type: String,
        enum: ['view', 'search', 'wishlist', 'chat', 'purchase'],
        required: true,
    },
    kategori: {
        type: String,
        required: true,
    },
}, {
    timestamps: true,
});

// Index for getting user's interactions efficiently
userInteractionSchema.index({ user: 1, type: 1, createdAt: -1 });
// Index for getting product interactions
userInteractionSchema.index({ product: 1, type: 1 });
// Index for category-based lookups
userInteractionSchema.index({ user: 1, kategori: 1 });
// TTL index - automatically delete interactions older than 90 days
userInteractionSchema.index({ createdAt: 1 }, { expireAfterSeconds: 90 * 24 * 60 * 60 });

module.exports = mongoose.model('UserInteraction', userInteractionSchema);
