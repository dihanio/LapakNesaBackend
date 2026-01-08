const mongoose = require('mongoose');

const conversationSchema = new mongoose.Schema({
    participants: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    }],
    product: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
    },
    lastMessage: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
    },
    lastMessageAt: {
        type: Date,
        default: Date.now,
    },
    // Users who have hidden this conversation (it will reappear when new message arrives)
    hiddenBy: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    // Map of when each user cleared the history (messages before this date are hidden)
    clearedAt: {
        type: Map,
        of: Date,
        default: {},
    },
}, {
    timestamps: true,
});

// Index for finding conversations by participants
conversationSchema.index({ participants: 1 });

module.exports = mongoose.model('Conversation', conversationSchema);
