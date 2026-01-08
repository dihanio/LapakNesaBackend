require('dotenv').config();
const mongoose = require('mongoose');
const User = require('./models/User');
const connectDB = require('./config/db');

const SUPER_ADMIN_DATA = {
    nama: 'Super Admin',
    email: process.env.SUPER_ADMIN_EMAIL,
    password: process.env.SUPER_ADMIN_PASSWORD,
    role: 'super_admin',
    isVerified: true,
    fakultas: 'Administrator',
    verification: {
        status: 'verified',
        verifiedAt: new Date(),
    },
};

async function seedSuperAdmin() {
    try {
        await connectDB();

        console.log('🔧 Setting up Super Admin...\n');

        // Check if super admin already exists
        const existingAdmin = await User.findOne({ email: SUPER_ADMIN_DATA.email });

        if (existingAdmin) {
            console.log('⚠️  Super Admin sudah ada dengan email:', SUPER_ADMIN_DATA.email);
            console.log('   Menghapus dan membuat ulang...');
            await User.deleteOne({ email: SUPER_ADMIN_DATA.email });
        }

        // Create super admin
        const superAdmin = await User.create(SUPER_ADMIN_DATA);

        console.log('✅ Super Admin berhasil dibuat!');
        console.log('');
        console.log('📧 Email:', SUPER_ADMIN_DATA.email);
        console.log('🔑 Password:', SUPER_ADMIN_DATA.password);
        console.log('');

        process.exit(0);
    } catch (error) {
        console.error('❌ Gagal:', error.message);
        process.exit(1);
    }
}

seedSuperAdmin();
