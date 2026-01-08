const express = require('express');
const router = express.Router();
const jwt = require('jsonwebtoken');
const { OAuth2Client } = require('google-auth-library');
const User = require('../models/User');
const { protect } = require('../middleware/auth');
const { authLimiter } = require('../middleware/rateLimit');
const { login, register, updateProfile } = require('../controllers/authController');

const GOOGLE_CLIENT_ID = process.env.GOOGLE_CLIENT_ID;
const GOOGLE_CLIENT_SECRET = process.env.GOOGLE_CLIENT_SECRET;
const GOOGLE_CALLBACK_URL = process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback';
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173';

const oauth2Client = new OAuth2Client(
    GOOGLE_CLIENT_ID,
    GOOGLE_CLIENT_SECRET,
    GOOGLE_CALLBACK_URL
);

const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @route   POST /api/auth/register
router.post('/register', authLimiter, register);

// @route   POST /api/auth/login
router.post('/login', authLimiter, login);

// @route   GET /api/auth/google
router.get('/google', (req, res) => {
    const authUrl = oauth2Client.generateAuthUrl({
        access_type: 'offline',
        scope: ['profile', 'email'],
        prompt: 'select_account',
    });
    res.redirect(authUrl);
});

// @route   GET /api/auth/google/callback
router.get('/google/callback', async (req, res) => {
    const { code, error } = req.query;

    if (error) {
        return res.redirect(`${FRONTEND_URL}/login?error=google_denied`);
    }

    if (!code) {
        return res.redirect(`${FRONTEND_URL}/login?error=no_code`);
    }

    try {
        const { tokens } = await oauth2Client.getToken(code);
        oauth2Client.setCredentials(tokens);

        const ticket = await oauth2Client.verifyIdToken({
            idToken: tokens.id_token,
            audience: GOOGLE_CLIENT_ID,
        });

        const payload = ticket.getPayload();
        const email = payload.email;
        const nama = payload.name;
        const avatar = payload.picture;
        const googleId = payload.sub;

        if (!email.endsWith('@mhs.unesa.ac.id')) {
            return res.redirect(`${FRONTEND_URL}/login?error=invalid_domain`);
        }

        let user = await User.findOne({ email });

        if (!user) {
            user = await User.create({
                googleId,
                email,
                nama,
                avatar,
                isVerified: false,
            });
        } else {
            if (!user.googleId) {
                user.googleId = googleId;
                user.avatar = avatar || user.avatar;
                await user.save();
            }
        }

        const token = generateToken(user._id);
        res.redirect(`${FRONTEND_URL}/auth/callback?token=${token}`);

    } catch (error) {
        res.redirect(`${FRONTEND_URL}/login?error=oauth_failed`);
    }
});

// @route   GET /api/auth/me
router.get('/me', protect, async (req, res) => {
    try {
        const user = await User.findById(req.user.id);
        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        res.status(500).json({
            success: false,
            message: 'Gagal mengambil data user',
        });
    }
});

const upload = require('../middleware/upload');

// @route   PUT /api/auth/profile
// @desc    Update user profile (name, avatar)
router.put('/profile', protect, updateProfile);

// @route   PUT /api/auth/complete-profile
router.put('/complete-profile', protect, upload.single('ktmImage'), async (req, res) => {
    try {
        const { nim, fakultas, whatsapp, role } = req.body;

        if (!nim || !fakultas || !whatsapp) {
            return res.status(400).json({
                success: false,
                message: 'NIM, Fakultas, dan WhatsApp wajib diisi',
            });
        }

        const updateData = {
            nim,
            fakultas,
            whatsapp,
            isVerified: true, // This is basic profile completion verification
        };

        // If user requests to be a seller (or forces role update)
        if (role === 'penjual') {
            // Check if KTM is uploaded
            if (!req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Upload Foto KTM wajib untuk verifikasi penjual',
                });
            }

            // Handle file path - could be Cloudinary URL or local path
            let ktmImagePath = req.file.path;

            // If it's a local file, convert to URL path
            if (!ktmImagePath.startsWith('http')) {
                ktmImagePath = `/uploads/${req.file.filename}`;
            }

            updateData.verification = {
                status: 'pending',
                ktmImage: ktmImagePath,
                submittedAt: new Date(),
            };
            // Do NOT update role to 'penjual' yet. Keep current role (pembeli).
        }

        const user = await User.findByIdAndUpdate(
            req.user.id,
            updateData,
            { new: true }
        );

        res.json({
            success: true,
            message: role === 'penjual'
                ? 'Profil berhasil dilengkapi. Menunggu verifikasi admin untuk menjadi penjual.'
                : 'Profil berhasil dilengkapi.',
            data: user,
        });
    } catch (error) {
        console.error('[Complete Profile Error]', error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal melengkapi profil',
        });
    }
});

module.exports = router;
