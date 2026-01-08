require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');
const jwt = require('jsonwebtoken');
const connectDB = require('./config/db');
const authRoutes = require('./routes/authRoutes');
const productRoutes = require('./routes/productRoutes');
const { apiLimiter } = require('./middleware/rateLimit');

const logger = require('./utils/logger');

const app = express();
const server = http.createServer(app);

// Allowed origins for CORS (used by both Express and Socket.IO)
const allowedOrigins = process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : ['http://localhost:5173', 'http://localhost:3000'];

// Socket.io setup
const io = new Server(server, {
    cors: {
        origin: allowedOrigins,
        credentials: true,
    },
});

// Socket.io initialization using extracted handler
const setupSocket = require('./socketHandler');
setupSocket(io);

// Make io accessible to routes
app.set('io', io);

// Connect to database
connectDB();

// Security Middleware
// Security Middleware
app.use(helmet({
    crossOriginResourcePolicy: { policy: "cross-origin" },
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],
            connectSrc: ["'self'", "http://localhost:5000", "ws://localhost:5000", "https://*.cloudinary.com", "https://accounts.google.com"],
            imgSrc: ["'self'", "data:", "blob:", "https://*.cloudinary.com", "https://*.googleusercontent.com"],
            scriptSrc: ["'self'", "'unsafe-inline'"], // unsafe-inline might be needed for some inline scripts, ideally remove it
            styleSrc: ["'self'", "'unsafe-inline'"],
            fontSrc: ["'self'", "data:", "https://fonts.gstatic.com"],
        },
    },
}));

// CORS Configuration
app.use(cors({
    origin: allowedOrigins,
    credentials: true,
}));

// Trust Proxy (for Heroku/Nginx/Cloudflare)
app.set('trust proxy', 1);

app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data Sanitization against NoSQL query injection (Apply only to API routes to avoid Socket.IO conflicts)
// Data Sanitization against NoSQL query injection (Apply only to API routes to avoid Socket.IO conflicts)
const mongoSanitize = require('express-mongo-sanitize');
// app.use('/api', mongoSanitize()); // Temporarily disabled due to conflict with Bun/Socket.IO (ReadOnly property error)

// Serve uploaded files statically
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Apply general rate limiter to all API routes
app.use('/api', apiLimiter);

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/products', productRoutes);
app.use('/api/chat', require('./routes/chatRoutes'));
app.use('/api/admin', require('./routes/adminRoutes'));
app.use('/api/wishlist', require('./routes/wishlistRoutes'));
app.use('/api/users', require('./routes/userRoutes'));
app.use('/api/reports', require('./routes/reportRoutes'));
app.use('/api/activity-logs', require('./routes/activityLogRoutes'));

// Public banner route (no auth required)
const bannerController = require('./controllers/bannerController');
app.get('/api/banners', bannerController.getActiveBanners);

// Maintenance mode check (public)
const Settings = require('./models/Settings');
app.get('/api/maintenance-status', async (req, res) => {
    try {
        const isMaintenanceMode = await Settings.get('maintenanceMode', false);
        res.json({
            success: true,
            maintenance: isMaintenanceMode,
            message: isMaintenanceMode ? 'Situs sedang dalam pemeliharaan' : null
        });
    } catch (error) {
        res.json({ success: true, maintenance: false });
    }
});

// Health check
app.get('/api/health', (req, res) => {
    res.json({ status: 'OK', message: 'LapakNesa API is running 🚀' });
});

// 404 handler
app.use((req, res) => {
    res.status(404).json({
        success: false,
        message: 'Endpoint tidak ditemukan',
    });
});

// Error handler
app.use((err, req, res, next) => {
    logger.error('Server Error:', err);
    res.status(500).json({
        success: false,
        message: process.env.NODE_ENV === 'production'
            ? 'Terjadi kesalahan server'
            : err.message || 'Terjadi kesalahan server',
    });
});

const PORT = process.env.PORT || 5000;

server.listen(PORT, () => {
    logger.info(`
  🛍️  LapakNesa Backend Server
  ============================
  🚀 Server running on port ${PORT}
  📍 API URL: http://localhost:${PORT}/api
  🔗 Health check: http://localhost:${PORT}/api/health
  🔐 Google OAuth: http://localhost:${PORT}/api/auth/google
  🔌 WebSocket: ws://localhost:${PORT}
  🔒 Helmet: Enabled
  📝 Logger: ${process.env.NODE_ENV === 'production' ? 'File + Console' : 'Console only'}
  `);
});
