const mongoose = require('mongoose');

const messageSchema = new mongoose.Schema({
    conversation: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Conversation',
        required: true,
    },
    sender: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    content: {
        type: String,
        trim: true,
    },
    image: {
        type: String, // Cloudinary URL
        default: null,
    },
    replyTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Message',
        default: null,
    },
    read: {
        type: Boolean,
        default: false,
    },
    // Soft delete
    isDeleted: {
        type: Boolean,
        default: false,
    },
    deletedAt: {
        type: Date,
        default: null,
    },
    // E2E Encryption fields
    encrypted: {
        type: Boolean,
        default: false,
    },
    ciphertext: {
        type: String,
        default: null,
    },
    iv: {
        type: String,
        default: null,
    },
    sessionKey: {
        type: String,
        default: null,
    },
    encryptedImage: {
        type: String,
        default: null,
    },
    imageIv: {
        type: String,
        default: null,
    },
    imageMimeType: {
        type: String,
        default: null,
    },
    // GIF/Sticker
    messageType: {
        type: String,
        enum: ['text', 'image', 'gif', 'sticker'],
        default: 'text',
    },
    gifUrl: {
        type: String,
        default: null,
    },
}, {
    timestamps: true,
});

// Custom validation: either content or image must be present (skip for deleted messages)
messageSchema.path('content').validate(function () {
    // Skip validation for deleted messages
    if (this.isDeleted) return true;
    // Skip if it has encrypted content
    if (this.ciphertext || this.encryptedImage) return true;
    // Skip if it has GIF
    if (this.gifUrl) return true;
    return this.content || this.image;
}, 'Pesan harus berisi teks atau gambar');

module.exports = mongoose.model('Message', messageSchema);
