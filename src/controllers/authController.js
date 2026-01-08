const jwt = require('jsonwebtoken');
const User = require('../models/User');
const activityLogService = require('../services/activityLogService');

// Generate JWT Token
const generateToken = (id) => {
    return jwt.sign({ id }, process.env.JWT_SECRET, {
        expiresIn: '30d',
    });
};

// @desc    Register user
// @route   POST /api/auth/register
// @access  Public
const register = async (req, res) => {
    try {
        const { nama, email, password, fakultas, jurusan } = req.body;

        // Check if user exists
        const userExists = await User.findOne({ email });
        if (userExists) {
            return res.status(400).json({
                success: false,
                message: 'Email sudah terdaftar',
            });
        }

        // Validate UNESA email domain
        if (!email.endsWith('@mhs.unesa.ac.id')) {
            return res.status(400).json({
                success: false,
                message: 'Hanya email mahasiswa UNESA (@mhs.unesa.ac.id) yang diperbolehkan',
            });
        }

        // Create user
        const user = await User.create({
            nama,
            email,
            password,
            fakultas,
            jurusan,
        });

        if (user) {
            // Log user registration
            await activityLogService.logUserRegistered(
                user._id,
                user.role,
                user._id,
                { nama: user.nama, email: user.email, fakultas: user.fakultas },
                req
            );

            res.status(201).json({
                success: true,
                data: {
                    _id: user._id,
                    nama: user.nama,
                    email: user.email,
                    role: user.role,
                    avatar: user.avatar,
                    verification: user.verification,
                    fakultas: user.fakultas,
                    jurusan: user.jurusan,
                    token: generateToken(user._id),
                },
            });
        }
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Login user
// @route   POST /api/auth/login
// @access  Public
const login = async (req, res) => {
    try {
        const { email, password } = req.body;


        // Check for user email
        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            return res.status(401).json({
                success: false,
                message: 'Email atau password salah',
            });
        }

        // Check password
        const isMatch = await user.matchPassword(password);

        if (!isMatch) {
            return res.status(401).json({
                success: false,
                message: 'Email atau password salah',
            });
        }


        // Log admin/super_admin login
        if (user.role === 'admin' || user.role === 'super_admin') {
            await activityLogService.logAdminLogin(user, req);
        }

        res.json({
            success: true,
            data: {
                _id: user._id,
                nama: user.nama,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                verification: user.verification,
                fakultas: user.fakultas,
                jurusan: user.jurusan,
                token: generateToken(user._id),
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get current user
// @route   GET /api/auth/me
// @access  Private
const getMe = async (req, res) => {
    try {
        const user = await User.findById(req.user._id);
        res.json({
            success: true,
            data: user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Update user profile (name, avatar)
// @route   PUT /api/auth/profile
// @access  Private
const updateProfile = async (req, res) => {
    try {
        const { nama, avatar } = req.body;

        const user = await User.findById(req.user._id);
        if (!user) {
            return res.status(404).json({
                success: false,
                message: 'User tidak ditemukan',
            });
        }

        // Update fields if provided
        if (nama) user.nama = nama.trim();
        if (avatar !== undefined) user.avatar = avatar;

        await user.save();

        res.json({
            success: true,
            message: 'Profil berhasil diperbarui',
            data: {
                _id: user._id,
                nama: user.nama,
                email: user.email,
                role: user.role,
                avatar: user.avatar,
                verification: user.verification,
                fakultas: user.fakultas,
            },
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Gagal memperbarui profil',
        });
    }
};

module.exports = { register, login, getMe, updateProfile };
