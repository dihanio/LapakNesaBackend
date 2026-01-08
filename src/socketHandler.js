const jwt = require('jsonwebtoken');
const User = require('./models/User');
const Conversation = require('./models/Conversation');
const Message = require('./models/Message');

const onlineUsers = new Map();

const setupSocket = (io) => {
    // Socket.io authentication middleware
    io.use((socket, next) => {
        const token = socket.handshake.auth.token;
        if (!token) {
            return next(new Error('Authentication required'));
        }
        try {
            const decoded = jwt.verify(token, process.env.JWT_SECRET);
            socket.userId = decoded.id;
            next();
        } catch (err) {
            next(new Error('Invalid token'));
        }
    });

    io.on('connection', async (socket) => {
        console.log(`🔌 User connected: ${socket.userId}`);

        // Add user to online users
        onlineUsers.set(socket.userId, socket.id);

        // Update user online status
        try {
            await User.findByIdAndUpdate(socket.userId, {
                isOnline: true,
                lastActive: new Date()
            });
            // Broadcast user online status to all connected users
            io.emit('user_status_change', { userId: socket.userId, isOnline: true });
        } catch (err) {
            console.error('Failed to update online status:', err);
        }

        // Join user to their own room for receiving notifications
        socket.join(socket.userId);
        console.log(`📬 User ${socket.userId} joined personal room: ${socket.userId}`);

        // Join conversation room
        socket.on('join_conversation', (conversationId) => {
            socket.join(`conversation_${conversationId}`);
            console.log(`User ${socket.userId} joined conversation ${conversationId}`);
        });

        // Leave conversation room
        socket.on('leave_conversation', (conversationId) => {
            socket.leave(`conversation_${conversationId}`);
        });

        // Handle sending message
        socket.on('send_message', async (data) => {
            const { conversationId, content, replyToId } = data;

            try {
                // Verify user is participant
                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.includes(socket.userId)) {
                    socket.emit('error', { message: 'Unauthorized' });
                    return;
                }

                // Create message
                const messageData = {
                    conversation: conversationId,
                    sender: socket.userId,
                    content: content?.trim() || '',
                };

                if (replyToId) {
                    messageData.replyTo = replyToId;
                }

                const message = await Message.create(messageData);

                // Update conversation - IMPORTANT: Also clear hiddenBy so chat reappears
                await Conversation.findByIdAndUpdate(conversationId, {
                    lastMessage: message._id,
                    lastMessageAt: new Date(),
                    hiddenBy: [], // Clear hidden state so chat reappears in main list
                });

                // Populate sender and reply info
                await message.populate('sender', 'nama avatar');
                await message.populate({
                    path: 'replyTo',
                    select: 'content sender image',
                    populate: { path: 'sender', select: 'nama' }
                });

                // Emit to all users in the conversation room
                io.to(`conversation_${conversationId}`).emit('new_message', {
                    conversationId,
                    message: message,
                });

                // Also emit to recipient's personal room for notification
                const recipientId = conversation.participants.find(p => p.toString() !== socket.userId);
                if (recipientId) {
                    io.to(recipientId.toString()).emit('message_notification', {
                        conversationId,
                        message: message,
                    });
                }

            } catch (error) {
                console.error('Socket send_message error:', error);
                socket.emit('error', { message: 'Failed to send message' });
            }
        });

        // Handle typing indicator
        socket.on('typing', (data) => {
            socket.to(`conversation_${data.conversationId}`).emit('user_typing', {
                conversationId: data.conversationId,
                userId: socket.userId,
            });
        });

        socket.on('stop_typing', (data) => {
            socket.to(`conversation_${data.conversationId}`).emit('user_stop_typing', {
                conversationId: data.conversationId,
                userId: socket.userId,
            });
        });

        // Handle mark as read
        socket.on('mark_as_read', async (data) => {
            const { conversationId } = data;

            try {
                // Verify user is participant
                const conversation = await Conversation.findById(conversationId);
                if (!conversation || !conversation.participants.includes(socket.userId)) {
                    return;
                }

                // Mark all unread messages in this conversation as read
                await Message.updateMany(
                    {
                        conversation: conversationId,
                        sender: { $ne: socket.userId },
                        read: false
                    },
                    { read: true }
                );

                // Notify the other participant that their messages were read
                const otherParticipant = conversation.participants.find(p => p.toString() !== socket.userId);
                if (otherParticipant) {
                    io.to(`conversation_${conversationId}`).emit('messages_read', {
                        conversationId,
                        readBy: socket.userId,
                    });
                }
            } catch (error) {
                console.error('Socket mark_as_read error:', error);
            }
        });

        socket.on('disconnect', async () => {
            console.log(`🔌 User disconnected: ${socket.userId}`);
            onlineUsers.delete(socket.userId);

            // Update user offline status and last active time
            try {
                await User.findByIdAndUpdate(socket.userId, {
                    isOnline: false,
                    lastActive: new Date()
                });
                // Broadcast user offline status to all connected users
                io.emit('user_status_change', { userId: socket.userId, isOnline: false, lastActive: new Date() });
            } catch (err) {
                console.error('Failed to update offline status:', err);
            }
        });
    });
};

module.exports = setupSocket;
