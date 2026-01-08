const mongoose = require('mongoose');

const bannerSchema = new mongoose.Schema({
    imageUrl: {
        type: String,
        required: [true, 'Gambar banner wajib diupload'],
    },
    title: {
        type: String,
        trim: true,
        default: '',
    },
    link: {
        type: String,
        trim: true,
        default: '',
    },
    order: {
        type: Number,
        default: 0,
    },
    isActive: {
        type: Boolean,
        default: true,
    },
}, {
    timestamps: true,
});

bannerSchema.index({ order: 1 });
bannerSchema.index({ isActive: 1 });

module.exports = mongoose.model('Banner', bannerSchema);
