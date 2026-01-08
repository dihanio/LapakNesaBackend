const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');

const resetAdmin = async () => {
    try {
        await connectDB();
        console.log('Connected to DB...');

        // 1. Demote old admin
        const oldAdminEmail = 'diha.23212@mhs.unesa.ac.id';
        const oldAdmin = await User.findOne({ email: oldAdminEmail });
        if (oldAdmin) {
            oldAdmin.role = 'pembeli';
            await oldAdmin.save();
            console.log(`✅ Demoted ${oldAdminEmail} to 'pembeli'.`);
        } else {
            console.log(`ℹ️ User ${oldAdminEmail} not found (skipping demotion).`);
        }

        // 2. Promote/Create new admin
        const newAdminEmail = 'dihaanfeu123@gmail.com';
        const newAdminPass = 'Nioganteng12345';

        let newAdmin = await User.findOne({ email: newAdminEmail });

        if (newAdmin) {
            console.log(`ℹ️ Found existing user ${newAdminEmail}. Updating...`);
            newAdmin.role = 'admin';
            newAdmin.password = newAdminPass; // Will be hashed by pre-save hook
            await newAdmin.save();
            console.log(`✅ Updated ${newAdminEmail} to Admin with new password.`);
        } else {
            console.log(`ℹ️ Creating new user ${newAdminEmail}...`);
            newAdmin = await User.create({
                nama: 'Super Admin',
                email: newAdminEmail,
                password: newAdminPass, // Will be hashed by pre-save hook
                role: 'admin',
                avatar: null
            });
            console.log(`✅ Created new Admin user: ${newAdminEmail}`);
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

resetAdmin();
