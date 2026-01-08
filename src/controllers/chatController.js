const Conversation = require('../models/Conversation');
const Message = require('../models/Message');
const User = require('../models/User');
const Product = require('../models/Product');
const cloudinary = require('../config/cloudinary');

// @desc    Store user's public key for E2E encryption
// @route   POST /api/chat/public-key
exports.storePublicKey = async (req, res) => {
    try {
        const { publicKey } = req.body;

        if (!publicKey) {
            return res.status(400).json({
                success: false,
                message: 'Public key diperlukan',
            });
        }

        await User.findByIdAndUpdate(req.user._id, { publicKey });

        res.json({
            success: true,
            message: 'Public key berhasil disimpan',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal menyimpan public key',
        });
    }
};

// @desc    Get user's public key for encryption
// @route   GET /api/chat/public-key/:userId
exports.getPublicKey = async (req, res) => {
    try {
        const user = await User.findById(req.params.userId).select('+publicKey');

        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        res.json({
            success: true,
            data: {
                userId: user._id,
                publicKey: user.publicKey || null,
            },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil public key',
        });
    }
};

// @desc    Get all conversations for current user
// @route   GET /api/chat/conversations
exports.getConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id,
            hiddenBy: { $ne: req.user._id } // Exclude conversations hidden by this user
        })
            .populate('participants', 'nama avatar email isOnline lastActive role')
            .populate('product', 'namaBarang gambar harga')
            .populate('lastMessage', 'content encrypted encryptedImage image createdAt')
            .sort({ lastMessageAt: -1 });

        // Add unread count for each conversation
        const conversationsWithUnread = await Promise.all(
            conversations.map(async (conv) => {
                const unreadCount = await Message.countDocuments({
                    conversation: conv._id,
                    sender: { $ne: req.user._id },
                    read: false,
                });
                return {
                    ...conv.toObject(),
                    unreadCount,
                };
            })
        );

        res.json({
            success: true,
            data: conversationsWithUnread,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil percakapan',
        });
    }
};

// @desc    Get hidden conversations for current user
// @route   GET /api/chat/conversations/hidden
exports.getHiddenConversations = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id,
            hiddenBy: req.user._id // Only conversations hidden by this user
        })
            .populate('participants', 'nama avatar email isOnline lastActive role')
            .populate('product', 'namaBarang gambar harga')
            .populate('lastMessage', 'content encrypted encryptedImage image createdAt')
            .sort({ lastMessageAt: -1 });

        res.json({
            success: true,
            data: conversations,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil percakapan tersembunyi',
        });
    }
};

// @desc    Restore (unhide) a conversation
// @route   PUT /api/chat/conversations/:id/restore
exports.restoreConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Anda bukan bagian dari percakapan ini',
            });
        }

        // Remove user from hiddenBy array
        conversation.hiddenBy = conversation.hiddenBy.filter(
            id => id.toString() !== req.user._id.toString()
        );
        await conversation.save();

        res.json({
            success: true,
            message: 'Percakapan berhasil dipulihkan',
            data: conversation
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal memulihkan percakapan',
        });
    }
};

// @desc    Create or get existing conversation
// @route   POST /api/chat/conversations
exports.createConversation = async (req, res) => {
    try {
        const { recipientId, productId, clearProduct } = req.body;

        if (!recipientId) {
            return res.status(400).json({
                success: false,
                message: 'Recipient ID diperlukan',
            });
        }

        // Can't chat with yourself
        if (recipientId === req.user._id.toString()) {
            return res.status(400).json({
                success: false,
                message: 'Tidak bisa chat dengan diri sendiri',
            });
        }

        // Check if recipient exists
        const recipient = await User.findById(recipientId);
        if (!recipient) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        // Find existing conversation between these users (regardless of product)
        let conversation = await Conversation.findOne({
            participants: { $all: [req.user._id, recipientId] },
        });

        if (!conversation) {
            // Create new conversation
            conversation = await Conversation.create({
                participants: [req.user._id, recipientId],
                product: productId || null,
            });
        } else {
            // Update product reference based on context
            if (clearProduct) {
                // Clear product context (e.g., when starting chat from seller page)
                if (conversation.product) {
                    conversation.product = null;
                    await conversation.save();
                }
            } else if (productId && (!conversation.product || conversation.product.toString() !== productId)) {
                // Update to new product if provided
                conversation.product = productId;
                await conversation.save();
            }
        }

        // Populate the conversation
        conversation = await Conversation.findById(conversation._id)
            .populate('participants', 'nama avatar email isOnline lastActive role')
            .populate('product', 'namaBarang gambar harga');

        res.status(201).json({
            success: true,
            data: conversation,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal membuat percakapan',
        });
    }
};

// @desc    Hide a conversation for the current user
// @route   DELETE /api/chat/conversations/:id
exports.deleteConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Anda bukan bagian dari percakapan ini',
            });
        }

        // Add user to hiddenBy array if not already there
        if (!conversation.hiddenBy.includes(req.user._id)) {
            conversation.hiddenBy.push(req.user._id);
            await conversation.save();
        }

        res.json({
            success: true,
            message: 'Percakapan berhasil dihapus',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal menghapus percakapan',
        });
    }
};

// @desc    Hard delete a conversation (Clear History)
// @route   DELETE /api/chat/conversations/:id/hard
exports.hardDeleteConversation = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Anda bukan bagian dari percakapan ini',
            });
        }

        // 1. Hide the conversation (same as soft delete)
        if (!conversation.hiddenBy.includes(req.user._id)) {
            conversation.hiddenBy.push(req.user._id);
        }

        // 2. Set clearedAt timestamp for this user
        conversation.clearedAt.set(req.user._id.toString(), new Date());

        await conversation.save();

        res.json({
            success: true,
            message: 'Percakapan berhasil dihapus permanen (riwayat dibersihkan)',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal menghapus permanen',
        });
    }
};

// @desc    Get messages for a conversation
// @route   GET /api/chat/conversations/:id/messages
exports.getMessages = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke percakapan ini',
            });
        }

        const messages = await Message.find({
            conversation: req.params.id,
            // Only show messages created AFTER the user cleared history
            createdAt: { $gt: conversation.clearedAt?.get(req.user._id.toString()) || new Date(0) }
        })
            .populate('sender', 'nama avatar')
            .populate({
                path: 'replyTo',
                select: 'content sender image encrypted ciphertext iv',
                populate: { path: 'sender', select: 'nama' }
            })
            .sort({ createdAt: 1 });

        // Mark messages as read
        await Message.updateMany(
            {
                conversation: req.params.id,
                sender: { $ne: req.user._id },
                read: false,
            },
            { read: true }
        );

        // Emit read receipt
        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${req.params.id}`).emit('messages_read', {
                conversationId: req.params.id,
                readBy: req.user._id,
            });
        }

        res.json({
            success: true,
            data: messages,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil pesan',
        });
    }
};

// @desc    Send a message (with E2E encryption support)
// @route   POST /api/chat/conversations/:id/messages
exports.sendMessage = async (req, res) => {
    try {
        const { content, replyToId, encrypted, ciphertext, iv, sessionKey } = req.body;

        // Validate: either plaintext content or encrypted content
        if (!encrypted && (!content || !content.trim())) {
            return res.status(400).json({
                success: false,
                message: 'Pesan tidak boleh kosong',
            });
        }

        if (encrypted && !ciphertext) {
            return res.status(400).json({
                success: false,
                message: 'Data enkripsi tidak valid',
            });
        }

        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke percakapan ini',
            });
        }

        // Create message
        const messageData = {
            conversation: req.params.id,
            sender: req.user._id,
        };

        if (encrypted) {
            // Encrypted message - don't store readable content
            messageData.encrypted = true;
            messageData.ciphertext = ciphertext;
            messageData.iv = iv;
            messageData.sessionKey = sessionKey || null;
            messageData.content = null; // No plaintext stored
        } else {
            // Plain text message
            messageData.content = content.trim();
        }

        if (replyToId) {
            messageData.replyTo = replyToId;
        }

        const message = await Message.create(messageData);

        // Update conversation's lastMessage
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        conversation.hiddenBy = []; // Clear hidden state when new message arrives
        await conversation.save();

        // Populate and return
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'nama avatar')
            .populate({
                path: 'replyTo',
                select: 'content sender image encrypted ciphertext iv',
                populate: { path: 'sender', select: 'nama' }
            });

        // Emit socket notification to recipient
        const io = req.app.get('io');
        if (io) {
            const recipientId = conversation.participants.find(
                p => p.toString() !== req.user._id.toString()
            );

            if (recipientId) {
                const recipientRoom = recipientId.toString();

                // Emit to conversation room for real-time update
                io.to(`conversation_${req.params.id}`).emit('new_message', {
                    conversationId: req.params.id,
                    message: populatedMessage,
                });

                // Emit notification to recipient's personal room
                io.to(recipientRoom).emit('message_notification', {
                    conversationId: req.params.id,
                    message: populatedMessage,
                });
            }
        }

        res.status(201).json({
            success: true,
            data: populatedMessage,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengirim pesan',
        });
    }
};

// @desc    Send an image message
// @route   POST /api/chat/conversations/:id/image
exports.sendImageMessage = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke percakapan ini',
            });
        }

        if (!req.file) {
            return res.status(400).json({
                success: false,
                message: 'Gambar diperlukan',
            });
        }

        // Upload to cloudinary
        const result = await cloudinary.uploader.upload(req.file.path, {
            folder: 'lapaknesa/chat',
            transformation: [{ width: 800, height: 800, crop: 'limit', quality: 'auto' }]
        });

        // Get optional caption from request body
        const caption = req.body.content?.trim() || null;

        // Create message with image and optional caption
        const message = await Message.create({
            conversation: req.params.id,
            sender: req.user._id,
            image: result.secure_url,
            content: caption,
        });

        // Update conversation's lastMessage and unhide for all users
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        conversation.hiddenBy = []; // Clear hidden state when new message arrives
        await conversation.save();

        // Populate and return
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'nama avatar');

        // Emit socket notification
        const io = req.app.get('io');
        if (io) {
            const recipientId = conversation.participants.find(
                p => p.toString() !== req.user._id.toString()
            );

            if (recipientId) {
                io.to(`conversation_${req.params.id}`).emit('new_message', {
                    conversationId: req.params.id,
                    message: populatedMessage,
                });

                io.to(recipientId.toString()).emit('message_notification', {
                    conversationId: req.params.id,
                    message: populatedMessage,
                });
            }
        }

        res.status(201).json({
            success: true,
            data: populatedMessage,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengirim gambar',
        });
    }
};

// @desc    Send an encrypted image message
// @route   POST /api/chat/conversations/:id/encrypted-image
exports.sendEncryptedImage = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke percakapan ini',
            });
        }

        const { encryptedImageData, imageIv, imageMimeType, sessionKey, ciphertext, iv, content } = req.body;

        if (!encryptedImageData || !imageIv) {
            return res.status(400).json({
                success: false,
                message: 'Data gambar terenkripsi diperlukan',
            });
        }

        // Create message with encrypted image and optional encrypted caption
        const messageData = {
            conversation: req.params.id,
            sender: req.user._id,
            encrypted: true,
            encryptedImage: encryptedImageData,
            imageIv: imageIv,
            imageMimeType: imageMimeType || 'image/jpeg',
            sessionKey: sessionKey,
        };

        // Add encrypted caption if provided
        if (ciphertext && iv) {
            messageData.ciphertext = ciphertext;
            messageData.iv = iv;
        } else if (content?.trim()) {
            // Fallback to unencrypted caption
            messageData.content = content.trim();
        }

        const message = await Message.create(messageData);

        // Update conversation's lastMessage and unhide for all users
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        conversation.hiddenBy = []; // Clear hidden state when new message arrives
        await conversation.save();

        // Populate and return
        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'nama avatar');

        // Emit socket notification
        const io = req.app.get('io');
        if (io) {
            const recipientId = conversation.participants.find(
                p => p.toString() !== req.user._id.toString()
            );

            if (recipientId) {
                io.to(`conversation_${req.params.id}`).emit('new_message', {
                    conversationId: req.params.id,
                    message: populatedMessage,
                });

                io.to(recipientId.toString()).emit('message_notification', {
                    conversationId: req.params.id,
                    message: populatedMessage,
                });
            }
        }

        res.status(201).json({
            success: true,
            data: populatedMessage,
        });
    } catch (error) {
        console.error('Error sending encrypted image:', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengirim gambar terenkripsi',
        });
    }
};

// @desc    Mark all messages in conversation as read
// @route   PUT /api/chat/conversations/:id/read
exports.markAsRead = async (req, res) => {
    try {
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        // Check if user is part of the conversation
        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke percakapan ini',
            });
        }

        // Mark all unread messages from other user as read
        const result = await Message.updateMany(
            {
                conversation: req.params.id,
                sender: { $ne: req.user._id },
                read: false,
            },
            { read: true }
        );

        // Emit read receipt to the other participant
        const io = req.app.get('io');
        if (io && result.modifiedCount > 0) {
            io.to(`conversation_${req.params.id}`).emit('messages_read', {
                conversationId: req.params.id,
                readBy: req.user._id,
            });
        }

        res.json({
            success: true,
            data: { markedAsRead: result.modifiedCount },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal menandai pesan',
        });
    }
};

// @desc    Get total unread message count
// @route   GET /api/chat/unread
exports.getUnreadCount = async (req, res) => {
    try {
        const conversations = await Conversation.find({
            participants: req.user._id
        });

        const conversationIds = conversations.map(c => c._id);

        const unreadCount = await Message.countDocuments({
            conversation: { $in: conversationIds },
            sender: { $ne: req.user._id },
            read: false,
        });

        res.json({
            success: true,
            data: { unreadCount },
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengambil jumlah pesan',
        });
    }
};

// @desc    Soft delete a message
// @route   DELETE /api/chat/messages/:id
exports.deleteMessage = async (req, res) => {
    try {
        const message = await Message.findById(req.params.id);

        if (!message) {
            return res.status(404).json({
                success: false,
                message: 'Pesan tidak ditemukan',
            });
        }

        // Only sender can delete their message
        if (message.sender.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak bisa menghapus pesan ini',
            });
        }

        // Soft delete
        message.isDeleted = true;
        message.deletedAt = new Date();
        message.content = null;
        message.ciphertext = null;
        message.image = null;
        message.encryptedImage = null;
        message.gifUrl = null;
        await message.save();

        // Emit socket event to notify other participant
        const io = req.app.get('io');
        if (io) {
            io.to(`conversation_${message.conversation}`).emit('message_deleted', {
                conversationId: message.conversation,
                messageId: message._id,
            });
        }

        res.json({
            success: true,
            message: 'Pesan berhasil dihapus',
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal menghapus pesan',
        });
    }
};

// @desc    Search messages across all conversations
// @route   GET /api/chat/search
exports.searchMessages = async (req, res) => {
    try {
        const { q, conversationId } = req.query;

        if (!q || q.trim().length < 2) {
            return res.status(400).json({
                success: false,
                message: 'Query harus minimal 2 karakter',
            });
        }

        // Build query
        let query = {
            content: { $regex: q, $options: 'i' },
            isDeleted: { $ne: true },
        };

        if (conversationId) {
            // Search in specific conversation
            const conversation = await Conversation.findById(conversationId);
            if (!conversation || !conversation.participants.includes(req.user._id)) {
                return res.status(403).json({
                    success: false,
                    message: 'Tidak memiliki akses ke percakapan ini',
                });
            }
            query.conversation = conversationId;
        } else {
            // Search in all user's conversations
            const conversations = await Conversation.find({
                participants: req.user._id
            });
            query.conversation = { $in: conversations.map(c => c._id) };
        }

        const messages = await Message.find(query)
            .populate('sender', 'nama avatar')
            .populate('conversation', 'participants product')
            .sort({ createdAt: -1 })
            .limit(50);

        res.json({
            success: true,
            data: messages,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mencari pesan',
        });
    }
};

// @desc    Send a GIF message
// @route   POST /api/chat/conversations/:id/gif
exports.sendGifMessage = async (req, res) => {
    try {
        const { gifUrl, caption } = req.body;

        if (!gifUrl) {
            return res.status(400).json({
                success: false,
                message: 'GIF URL diperlukan',
            });
        }

        const conversation = await Conversation.findById(req.params.id);
        if (!conversation) {
            return res.status(404).json({
                success: false,
                message: 'Percakapan tidak ditemukan',
            });
        }

        if (!conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses ke percakapan ini',
            });
        }

        const message = await Message.create({
            conversation: req.params.id,
            sender: req.user._id,
            content: caption || null,
            messageType: 'gif',
            gifUrl: gifUrl,
        });

        // Update conversation and unhide for all users
        conversation.lastMessage = message._id;
        conversation.lastMessageAt = new Date();
        conversation.hiddenBy = []; // Clear hidden state when new message arrives
        await conversation.save();

        const populatedMessage = await Message.findById(message._id)
            .populate('sender', 'nama avatar');

        // Emit socket notification
        const io = req.app.get('io');
        if (io) {
            const recipientId = conversation.participants.find(
                p => p.toString() !== req.user._id.toString()
            );
            if (recipientId) {
                io.to(recipientId.toString()).emit('new_message', {
                    conversationId: req.params.id,
                    message: populatedMessage,
                });
            }
        }

        res.status(201).json({
            success: true,
            data: populatedMessage,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengirim GIF',
        });
    }
};

// @desc    Emit typing indicator
// @route   POST /api/chat/conversations/:id/typing
exports.sendTypingIndicator = async (req, res) => {
    try {
        const { isTyping } = req.body;
        const conversation = await Conversation.findById(req.params.id);

        if (!conversation || !conversation.participants.includes(req.user._id)) {
            return res.status(403).json({
                success: false,
                message: 'Tidak memiliki akses',
            });
        }

        const io = req.app.get('io');
        if (io) {
            const recipientId = conversation.participants.find(
                p => p.toString() !== req.user._id.toString()
            );
            if (recipientId) {
                io.to(recipientId.toString()).emit('typing_indicator', {
                    conversationId: req.params.id,
                    userId: req.user._id,
                    userName: req.user.nama,
                    isTyping: Boolean(isTyping),
                });
            }
        }

        res.json({ success: true });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal mengirim status',
        });
    }
};
