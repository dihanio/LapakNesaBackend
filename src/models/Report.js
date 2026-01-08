const mongoose = require('mongoose');

const reportSchema = new mongoose.Schema({
    // Reporter  
    reporter: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },

    // Report type
    type: {
        type: String,
        enum: ['product', 'user', 'general'],
        required: true,
    },

    // Target (optional based on type)
    targetProduct: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Product',
        default: null,
    },
    targetUser: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },

    // Report details
    category: {
        type: String,
        enum: [
            'penipuan',
            'produk_palsu',
            'konten_tidak_pantas',
            'harga_tidak_wajar',
            'spam',
            'pelecehan',
            'akun_palsu',
            'bug_sistem',
            'saran',
            'pertanyaan',
            'lainnya'
        ],
        required: true,
    },
    subject: {
        type: String,
        required: [true, 'Judul laporan wajib diisi'],
        trim: true,
        maxlength: [200, 'Judul maksimal 200 karakter'],
    },
    description: {
        type: String,
        required: [true, 'Deskripsi laporan wajib diisi'],
        trim: true,
        maxlength: [2000, 'Deskripsi maksimal 2000 karakter'],
    },

    // Evidence (images)
    evidence: [{
        type: String, // Cloudinary URLs
    }],

    // Ticket status
    status: {
        type: String,
        enum: ['open', 'in_progress', 'resolved', 'closed'],
        default: 'open',
    },
    priority: {
        type: String,
        enum: ['low', 'medium', 'high', 'urgent'],
        default: 'medium',
    },

    // Ticket number (auto-generated)
    ticketNumber: {
        type: String,
        unique: true,
    },

    // Admin handling
    assignedTo: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    adminNotes: {
        type: String,
        default: null,
    },

    // Resolution
    resolution: {
        type: String,
        default: null,
    },
    resolvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    resolvedAt: {
        type: Date,
        default: null,
    },

    // Timestamps for status changes
    inProgressAt: {
        type: Date,
        default: null,
    },
    closedAt: {
        type: Date,
        default: null,
    },
}, {
    timestamps: true,
});

// Generate ticket number before saving
reportSchema.pre('save', async function () {
    if (this.isNew && !this.ticketNumber) {
        const date = new Date();
        const year = date.getFullYear().toString().slice(-2);
        const month = (date.getMonth() + 1).toString().padStart(2, '0');

        // Count reports this month
        const count = await this.constructor.countDocuments({
            createdAt: {
                $gte: new Date(date.getFullYear(), date.getMonth(), 1),
                $lt: new Date(date.getFullYear(), date.getMonth() + 1, 1),
            }
        });

        this.ticketNumber = `LN${year}${month}-${(count + 1).toString().padStart(4, '0')}`;
    }
});

// Index for efficient queries
reportSchema.index({ reporter: 1, createdAt: -1 });
reportSchema.index({ status: 1, priority: -1, createdAt: -1 });
reportSchema.index({ type: 1, status: 1 });

module.exports = mongoose.model('Report', reportSchema);
