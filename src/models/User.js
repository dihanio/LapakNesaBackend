const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
    nama: {
        type: String,
        required: [true, 'Nama wajib diisi'],
        trim: true,
    },
    email: {
        type: String,
        required: [true, 'Email wajib diisi'],
        unique: true,
        lowercase: true,
        trim: true,
        match: [/^\S+@\S+\.\S+$/, 'Format email tidak valid'],
    },
    password: {
        type: String,
        minlength: [6, 'Password minimal 6 karakter'],
        select: false,
    },
    googleId: {
        type: String,
        sparse: true,
    },
    role: {
        type: String,
        enum: ['pembeli', 'penjual', 'admin', 'super_admin'],
        default: 'pembeli',
    },
    verification: {
        status: {
            type: String,
            enum: ['none', 'pending', 'verified', 'rejected'],
            default: 'none',
        },
        ktmImage: String,
        submittedAt: Date,
        verifiedAt: Date,
        rejectedAt: Date,
        notes: String,
    },
    avatar: {
        type: String,
        default: null,
    },
    fakultas: {
        type: String,
        trim: true,
        default: null,
    },
    nim: {
        type: String,
        trim: true,
        default: null,
    },
    whatsapp: {
        type: String,
        trim: true,
        default: null,
    },
    isVerified: {
        type: Boolean,
        default: false,
    },
    isBanned: {
        type: Boolean,
        default: false,
    },
    lastActive: {
        type: Date,
        default: Date.now,
    },
    isOnline: {
        type: Boolean,
        default: false,
    },
    publicKey: {
        type: String,
        default: null,
        select: false, // Don't include by default in queries
    },
    // Follow feature
    followers: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    following: [{
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
    }],
    followersCount: {
        type: Number,
        default: 0,
    },
    followingCount: {
        type: Number,
        default: 0,
    },
}, {
    timestamps: true,
});

// Hash password before saving
userSchema.pre('save', async function () {
    if (!this.isModified('password') || !this.password) {
        return;
    }
    const salt = await bcrypt.genSalt(10);
    this.password = await bcrypt.hash(this.password, salt);
});

// Compare password method
userSchema.methods.matchPassword = async function (enteredPassword) {
    if (!this.password) return false;
    return await bcrypt.compare(enteredPassword, this.password);
};

// Check if profile is complete (for selling verification)
userSchema.methods.isProfileComplete = function () {
    return this.fakultas && this.nim && this.whatsapp;
};

module.exports = mongoose.model('User', userSchema);
