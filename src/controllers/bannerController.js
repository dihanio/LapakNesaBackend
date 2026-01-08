const Banner = require('../models/Banner');
const cloudinary = require('../config/cloudinary');
const activityLogService = require('../services/activityLogService');

const getActiveBanners = async (req, res) => {
    try {
        const banners = await Banner.find({ isActive: true })
            .sort({ order: 1 })
            .limit(10);

        res.json({
            success: true,
            data: banners,
        });
    } catch (error) {
        console.error('Error fetching banners:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data banner',
        });
    }
};

const getAllBanners = async (req, res) => {
    try {
        const banners = await Banner.find().sort({ order: 1 });

        res.json({
            success: true,
            data: banners,
        });
    } catch (error) {
        console.error('Error fetching all banners:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data banner',
        });
    }
};

const getBannerById = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner tidak ditemukan',
            });
        }

        res.json({
            success: true,
            data: banner,
        });
    } catch (error) {
        console.error('Error fetching banner:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data banner',
        });
    }
};

const createBanner = async (req, res) => {
    try {
        const { image, title, link, isActive } = req.body;

        if (!image) {
            return res.status(400).json({
                success: false,
                message: 'Gambar banner wajib diupload',
            });
        }

        let imageUrl = image;

        if (image.startsWith('data:')) {
            const result = await cloudinary.uploader.upload(image, {
                folder: 'lapaknesa/banners',
            });
            imageUrl = result.secure_url;
        }

        const bannerCount = await Banner.countDocuments();

        const banner = await Banner.create({
            imageUrl,
            title: title || '',
            link: link || '',
            order: bannerCount,
            isActive: isActive !== false,
        });

        // Log banner creation
        await activityLogService.logBannerCreated(
            req.user._id,
            req.user.role,
            banner._id,
            { title: banner.title || 'Tanpa judul' },
            req
        );

        res.status(201).json({
            success: true,
            message: 'Banner berhasil ditambahkan',
            data: banner,
        });
    } catch (error) {
        console.error('Error creating banner:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menambahkan banner',
        });
    }
};

const updateBanner = async (req, res) => {
    try {
        const { image, title, link, isActive, order } = req.body;

        const banner = await Banner.findById(req.params.id);
        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner tidak ditemukan',
            });
        }

        if (image && image.startsWith('data:')) {
            const result = await cloudinary.uploader.upload(image, {
                folder: 'lapaknesa/banners',
            });
            banner.imageUrl = result.secure_url;
        } else if (image) {
            banner.imageUrl = image;
        }

        if (title !== undefined) banner.title = title;
        if (link !== undefined) banner.link = link;
        if (isActive !== undefined) banner.isActive = isActive;
        if (order !== undefined) banner.order = order;

        await banner.save();

        // Log banner update
        await activityLogService.logBannerUpdated(
            req.user._id,
            req.user.role,
            banner._id,
            { title: banner.title || 'Tanpa judul' },
            req
        );

        res.json({
            success: true,
            message: 'Banner berhasil diupdate',
            data: banner,
        });
    } catch (error) {
        console.error('Error updating banner:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengupdate banner',
        });
    }
};

const deleteBanner = async (req, res) => {
    try {
        const banner = await Banner.findById(req.params.id);

        if (!banner) {
            return res.status(404).json({
                success: false,
                message: 'Banner tidak ditemukan',
            });
        }

        if (banner.imageUrl && banner.imageUrl.includes('cloudinary')) {
            try {
                const urlParts = banner.imageUrl.split('/');
                const publicIdWithExt = urlParts.slice(-2).join('/');
                const publicId = publicIdWithExt.replace(/\.[^/.]+$/, '');
                await cloudinary.uploader.destroy(`lapaknesa/banners/${publicId.split('/').pop()}`);
            } catch (cloudError) {
                console.error('Error deleting from Cloudinary:', cloudError);
            }
        }

        // Store banner info before deletion for logging
        const bannerInfo = { title: banner.title || 'Tanpa judul' };

        await Banner.findByIdAndDelete(req.params.id);

        // Log banner deletion
        await activityLogService.logBannerDeleted(
            req.user._id,
            req.user.role,
            req.params.id,
            bannerInfo,
            req
        );

        res.json({
            success: true,
            message: 'Banner berhasil dihapus',
        });
    } catch (error) {
        console.error('Error deleting banner:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal menghapus banner',
        });
    }
};

const reorderBanners = async (req, res) => {
    try {
        const { bannerIds } = req.body;

        if (!Array.isArray(bannerIds)) {
            return res.status(400).json({
                success: false,
                message: 'Format data tidak valid',
            });
        }

        const updatePromises = bannerIds.map((id, index) =>
            Banner.findByIdAndUpdate(id, { order: index })
        );

        await Promise.all(updatePromises);

        res.json({
            success: true,
            message: 'Urutan banner berhasil diupdate',
        });
    } catch (error) {
        console.error('Error reordering banners:', error);
        res.status(500).json({
            success: false,
            message: 'Gagal mengubah urutan banner',
        });
    }
};

module.exports = {
    getActiveBanners,
    getAllBanners,
    getBannerById,
    createBanner,
    updateBanner,
    deleteBanner,
    reorderBanners,
};
