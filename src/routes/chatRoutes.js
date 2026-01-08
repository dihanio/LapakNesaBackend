const express = require('express');
const router = express.Router();
const { protect } = require('../middleware/auth');
const upload = require('../middleware/upload');
const chatController = require('../controllers/chatController');

// ===================== E2E ENCRYPTION ROUTES =====================

// @route   POST /api/chat/public-key
// @desc    Store user's public key for E2E encryption
router.post('/public-key', protect, chatController.storePublicKey);

// @route   GET /api/chat/public-key/:userId
// @desc    Get user's public key for encryption
router.get('/public-key/:userId', protect, chatController.getPublicKey);

// ===================== CONVERSATION ROUTES =====================

// @route   GET /api/chat/conversations
// @desc    Get all conversations for current user
router.get('/conversations', protect, chatController.getConversations);

// @route   GET /api/chat/conversations/hidden
// @desc    Get hidden conversations for current user
router.get('/conversations/hidden', protect, chatController.getHiddenConversations);

// @route   PUT /api/chat/conversations/:id/restore
// @desc    Restore (unhide) a conversation
router.put('/conversations/:id/restore', protect, chatController.restoreConversation);

// @route   POST /api/chat/conversations
// @desc    Create or get existing conversation
router.post('/conversations', protect, chatController.createConversation);

// @route   DELETE /api/chat/conversations/:id
// @desc    Hide a conversation for the current user
router.delete('/conversations/:id', protect, chatController.deleteConversation);

// @route   DELETE /api/chat/conversations/:id/hard
// @desc    Hard delete a conversation (Clear History)
router.delete('/conversations/:id/hard', protect, chatController.hardDeleteConversation);

// @route   GET /api/chat/conversations/:id/messages
// @desc    Get messages for a conversation
router.get('/conversations/:id/messages', protect, chatController.getMessages);

// @route   POST /api/chat/conversations/:id/messages
// @desc    Send a message (with E2E encryption support)
router.post('/conversations/:id/messages', protect, chatController.sendMessage);

// @route   POST /api/chat/conversations/:id/image
// @desc    Send an image message
router.post('/conversations/:id/image', protect, upload.single('image'), chatController.sendImageMessage);

// @route   POST /api/chat/conversations/:id/encrypted-image
// @desc    Send an encrypted image message
router.post('/conversations/:id/encrypted-image', protect, chatController.sendEncryptedImage);

// @route   PUT /api/chat/conversations/:id/read
// @desc    Mark all messages in conversation as read
router.put('/conversations/:id/read', protect, chatController.markAsRead);

// @route   GET /api/chat/unread
// @desc    Get total unread message count
router.get('/unread', protect, chatController.getUnreadCount);

// ===================== MESSAGE DELETION =====================

// @route   DELETE /api/chat/messages/:id
// @desc    Soft delete a message
router.delete('/messages/:id', protect, chatController.deleteMessage);

// ===================== SEARCH MESSAGES =====================

// @route   GET /api/chat/search
// @desc    Search messages across all conversations
router.get('/search', protect, chatController.searchMessages);

// ===================== GIF/STICKER MESSAGES =====================

// @route   POST /api/chat/conversations/:id/gif
// @desc    Send a GIF message
router.post('/conversations/:id/gif', protect, chatController.sendGifMessage);

// ===================== TYPING INDICATOR =====================

// @route   POST /api/chat/conversations/:id/typing
// @desc    Emit typing indicator (alternative to pure socket)
router.post('/conversations/:id/typing', protect, chatController.sendTypingIndicator);

module.exports = router;
