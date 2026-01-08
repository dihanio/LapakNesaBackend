/**
 * Simple rate limiter middleware for Bun/Express
 * Uses in-memory store (resets on server restart)
 */

const rateLimitStore = new Map();

// Clean up old entries every 5 minutes
setInterval(() => {
    const now = Date.now();
    for (const [key, data] of rateLimitStore.entries()) {
        if (now > data.resetTime) {
            rateLimitStore.delete(key);
        }
    }
}, 5 * 60 * 1000);

/**
 * Create a rate limiter middleware
 * @param {Object} options
 * @param {number} options.windowMs - Time window in milliseconds
 * @param {number} options.max - Maximum requests per window
 * @param {string} options.message - Error message when limit exceeded
 */
const createRateLimiter = (options = {}) => {
    const {
        windowMs = 60 * 1000, // 1 minute default
        max = 100,
        message = 'Terlalu banyak permintaan, coba lagi nanti'
    } = options;

    return (req, res, next) => {
        // Use IP only as key to prevent bypass by hitting different endpoints
        const key = req.ip;
        const now = Date.now();

        let record = rateLimitStore.get(key);

        if (!record || now > record.resetTime) {
            // Create new record
            record = {
                count: 1,
                resetTime: now + windowMs
            };
            rateLimitStore.set(key, record);
            return next();
        }

        record.count++;

        if (record.count > max) {
            const retryAfter = Math.ceil((record.resetTime - now) / 1000);
            res.set('Retry-After', retryAfter);
            return res.status(429).json({
                success: false,
                message,
                retryAfter
            });
        }

        next();
    };
};

// Pre-configured rate limiters
const authLimiter = createRateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    max: 5, // 5 attempts per 15 minutes
    message: 'Terlalu banyak percobaan login, coba lagi dalam 15 menit'
});

const apiLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 300, // 300 requests per minute (increased for SPA/multi-tab support)
    message: 'Terlalu banyak permintaan, coba lagi nanti'
});

const chatLimiter = createRateLimiter({
    windowMs: 60 * 1000, // 1 minute
    max: 60, // 60 messages per minute
    message: 'Terlalu banyak pesan terkirim, tunggu sebentar'
});

const productLimiter = createRateLimiter({
    windowMs: 60 * 60 * 1000, // 1 hour
    max: 20, // 20 products per hour
    message: 'Anda sudah terlalu banyak posting produk, coba lagi nanti'
});

module.exports = {
    createRateLimiter,
    authLimiter,
    apiLimiter,
    chatLimiter,
    productLimiter
};
