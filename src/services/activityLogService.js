const ActivityLog = require('../models/ActivityLog');

/**
 * Activity Logger Service
 * Helper functions to easily log activities throughout the app
 */

const logActivity = async ({
    user,
    userRole,
    category,
    action,
    description,
    target,
    metadata,
    req,
}) => {
    try {
        const logData = {
            user: user._id || user,
            userRole: userRole || user.role || 'pembeli',
            category,
            action,
            description,
            target,
            metadata,
        };

        // Add request info if available
        if (req) {
            logData.ipAddress = req.ip || req.connection?.remoteAddress;
            logData.userAgent = typeof req.get === 'function' ? req.get('User-Agent') : req.headers?.['user-agent'];
        }

        return await ActivityLog.log(logData);
    } catch (error) {
        console.error('Failed to log activity:', error);
        return null;
    }
};

// Product-related logs
const logProductCreated = (user, product, req) => logActivity({
    user,
    userRole: user.role,
    category: 'product',
    action: 'product_created',
    description: `${user.nama} menambahkan produk "${product.namaBarang}"`,
    target: {
        type: 'Product',
        id: product._id,
        name: product.namaBarang,
    },
    metadata: {
        productId: product._id,
        kategori: product.kategori,
        harga: product.harga,
    },
    req,
});

const logProductUpdated = (user, product, changes, req) => logActivity({
    user,
    userRole: user.role,
    category: 'product',
    action: 'product_updated',
    description: `${user.nama} mengubah produk "${product.namaBarang}"`,
    target: {
        type: 'Product',
        id: product._id,
        name: product.namaBarang,
    },
    metadata: { changes },
    req,
});

const logProductDeleted = (user, product, req) => logActivity({
    user,
    userRole: user.role,
    category: 'product',
    action: 'product_deleted',
    description: `${user.nama} menghapus produk "${product.namaBarang}"`,
    target: {
        type: 'Product',
        id: product._id,
        name: product.namaBarang,
    },
    req,
});

const logProductSold = (user, product, req) => logActivity({
    user,
    userRole: user.role,
    category: 'product',
    action: 'product_sold',
    description: `Produk "${product.namaBarang}" ditandai terjual`,
    target: {
        type: 'Product',
        id: product._id,
        name: product.namaBarang,
    },
    req,
});

const logProductApproved = (admin, product, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'product',
    action: 'product_approved',
    description: `Admin ${admin.nama} menyetujui produk "${product.namaBarang}"`,
    target: {
        type: 'Product',
        id: product._id,
        name: product.namaBarang,
    },
    req,
});

const logProductRejected = (admin, product, reason, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'product',
    action: 'product_rejected',
    description: `Admin ${admin.nama} menolak produk "${product.namaBarang}"`,
    target: {
        type: 'Product',
        id: product._id,
        name: product.namaBarang,
    },
    metadata: { reason },
    req,
});

// User-related logs
const logUserRegistered = (user, req) => logActivity({
    user,
    userRole: 'pembeli',
    category: 'user',
    action: 'user_registered',
    description: `Pengguna baru terdaftar: ${user.nama}`,
    target: {
        type: 'User',
        id: user._id,
        name: user.nama,
    },
    req,
});

const logUserDeleted = (admin, targetUser, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'user',
    action: 'user_deleted',
    description: `Admin ${admin.nama} menghapus pengguna "${targetUser.nama}"`,
    target: {
        type: 'User',
        id: targetUser._id,
        name: targetUser.nama,
    },
    req,
});

const logUserBanned = (admin, targetUser, reason, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'user',
    action: 'user_banned',
    description: `Admin ${admin.nama} memblokir pengguna "${targetUser.nama}"`,
    target: {
        type: 'User',
        id: targetUser._id,
        name: targetUser.nama,
    },
    metadata: { reason },
    req,
});

const logUserUnbanned = (admin, targetUser, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'user',
    action: 'user_unbanned',
    description: `Admin ${admin.nama} membuka blokir pengguna "${targetUser.nama}"`,
    target: {
        type: 'User',
        id: targetUser._id,
        name: targetUser.nama,
    },
    req,
});

const logUserRoleChanged = (admin, targetUser, oldRole, newRole, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'user',
    action: 'user_role_changed',
    description: `Admin ${admin.nama} mengubah role "${targetUser.nama}" dari ${oldRole} ke ${newRole}`,
    target: {
        type: 'User',
        id: targetUser._id,
        name: targetUser.nama,
    },
    metadata: { oldRole, newRole },
    req,
});

// Admin-related logs
const logAdminLogin = (admin, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'admin',
    action: 'admin_login',
    description: `Admin ${admin.nama} login ke dashboard`,
    target: {
        type: 'User',
        id: admin._id,
        name: admin.nama,
    },
    req,
});

// Report-related logs
const logReportCreated = (user, report, req) => logActivity({
    user,
    userRole: user.role,
    category: 'report',
    action: 'report_created',
    description: `${user.nama} membuat laporan: ${report.subject}`,
    target: {
        type: 'Report',
        id: report._id,
        name: report.ticketNumber,
    },
    req,
});

const logReportResolved = (admin, report, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'report',
    action: 'report_resolved',
    description: `Admin ${admin.nama} menyelesaikan laporan #${report.ticketNumber}`,
    target: {
        type: 'Report',
        id: report._id,
        name: report.ticketNumber,
    },
    req,
});

const logReportClosed = (admin, report, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'report',
    action: 'report_closed',
    description: `Admin ${admin.nama} menutup laporan #${report.ticketNumber}`,
    target: {
        type: 'Report',
        id: report._id,
        name: report.ticketNumber,
    },
    req,
});

// Banner-related logs
const logBannerCreated = (admin, banner, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'banner',
    action: 'banner_created',
    description: `Admin ${admin.nama} menambahkan banner "${banner.title || 'Tanpa Judul'}"`,
    target: {
        type: 'Banner',
        id: banner._id,
        name: banner.title || 'Banner',
    },
    req,
});

const logBannerUpdated = (admin, banner, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'banner',
    action: 'banner_updated',
    description: `Admin ${admin.nama} mengubah banner "${banner.title || 'Tanpa Judul'}"`,
    target: {
        type: 'Banner',
        id: banner._id,
        name: banner.title || 'Banner',
    },
    req,
});

const logBannerDeleted = (admin, banner, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'banner',
    action: 'banner_deleted',
    description: `Admin ${admin.nama} menghapus banner "${banner.title || 'Tanpa Judul'}"`,
    target: {
        type: 'Banner',
        id: banner._id,
        name: banner.title || 'Banner',
    },
    req,
});

// Verification-related logs
const logVerificationSubmitted = (user, req) => logActivity({
    user,
    userRole: user.role,
    category: 'verification',
    action: 'verification_submitted',
    description: `${user.nama} mengajukan verifikasi akun`,
    target: {
        type: 'User',
        id: user._id,
        name: user.nama,
    },
    req,
});

const logVerificationApproved = (admin, targetUser, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'verification',
    action: 'verification_approved',
    description: `Admin ${admin.nama} menyetujui verifikasi "${targetUser.nama}"`,
    target: {
        type: 'User',
        id: targetUser._id,
        name: targetUser.nama,
    },
    req,
});

const logVerificationRejected = (admin, targetUser, reason, req) => logActivity({
    user: admin,
    userRole: admin.role,
    category: 'verification',
    action: 'verification_rejected',
    description: `Admin ${admin.nama} menolak verifikasi "${targetUser.nama}"`,
    target: {
        type: 'User',
        id: targetUser._id,
        name: targetUser.nama,
    },
    metadata: { reason },
    req,
});

module.exports = {
    logActivity,
    // Product
    logProductCreated,
    logProductUpdated,
    logProductDeleted,
    logProductSold,
    logProductApproved,
    logProductRejected,
    // User
    logUserRegistered,
    logUserDeleted,
    logUserBanned,
    logUserUnbanned,
    logUserRoleChanged,
    // Admin
    logAdminLogin,
    // Report
    logReportCreated,
    logReportResolved,
    logReportClosed,
    // Banner
    logBannerCreated,
    logBannerUpdated,
    logBannerDeleted,
    // Verification
    logVerificationSubmitted,
    logVerificationApproved,
    logVerificationRejected,
};
