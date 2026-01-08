const mongoose = require('mongoose');

const activityLogSchema = new mongoose.Schema({
    // User who performed the action
    user: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    // Type of user role at the time of action
    userRole: {
        type: String,
        enum: ['pembeli', 'penjual', 'admin', 'super_admin'],
        required: true,
    },
    // Action category
    category: {
        type: String,
        enum: ['product', 'user', 'admin', 'report', 'banner', 'verification', 'system'],
        required: true,
    },
    // Specific action
    action: {
        type: String,
        enum: [
            // Product actions
            'product_created',
            'product_updated',
            'product_deleted',
            'product_sold',
            'product_approved',
            'product_rejected',
            // User actions
            'user_registered',
            'user_updated',
            'user_deleted',
            'user_banned',
            'user_unbanned',
            'user_role_changed',
            // Admin actions
            'admin_login',
            'admin_logout',
            // Report actions
            'report_created',
            'report_resolved',
            'report_closed',
            // Banner actions
            'banner_created',
            'banner_updated',
            'banner_deleted',
            // Verification actions
            'verification_submitted',
            'verification_approved',
            'verification_rejected',
            // System actions
            'system_setting_changed',
        ],
        required: true,
    },
    // Description of the action
    description: {
        type: String,
        required: true,
    },
    // Target entity (product, user, etc.)
    target: {
        type: {
            type: String,
            enum: ['Product', 'User', 'Report', 'Banner', 'Verification', 'System'],
        },
        id: mongoose.Schema.Types.ObjectId,
        name: String, // Store name for reference even if entity is deleted
    },
    // Additional metadata
    metadata: {
        type: mongoose.Schema.Types.Mixed,
        default: {},
    },
    // IP address (optional, for security auditing)
    ipAddress: {
        type: String,
    },
    // User agent (optional)
    userAgent: {
        type: String,
    },
}, {
    timestamps: true,
});

// Indexes for efficient querying
activityLogSchema.index({ createdAt: -1 });
activityLogSchema.index({ user: 1, createdAt: -1 });
activityLogSchema.index({ category: 1, createdAt: -1 });
activityLogSchema.index({ action: 1, createdAt: -1 });
activityLogSchema.index({ 'target.type': 1, 'target.id': 1 });

// Static method to log activity
activityLogSchema.statics.log = async function(data) {
    try {
        const log = new this(data);
        await log.save();
        return log;
    } catch (error) {
        console.error('Failed to create activity log:', error);
        // Don't throw - logging should not break main flow
        return null;
    }
};

// Static method to get recent activities
activityLogSchema.statics.getRecent = async function(options = {}) {
    const {
        limit = 20,
        category,
        action,
        userId,
        targetType,
        targetId,
    } = options;

    const query = {};
    
    if (category) query.category = category;
    if (action) query.action = action;
    if (userId) query.user = userId;
    if (targetType) query['target.type'] = targetType;
    if (targetId) query['target.id'] = targetId;

    return this.find(query)
        .sort({ createdAt: -1 })
        .limit(limit)
        .populate('user', 'nama email avatar role')
        .lean();
};

module.exports = mongoose.model('ActivityLog', activityLogSchema);
