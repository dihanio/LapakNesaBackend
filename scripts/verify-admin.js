const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');

const verifyAdmin = async () => {
    try {
        await connectDB();
        console.log('Connected to DB...');

        const email = 'dihaanfeu123@gmail.com';
        const user = await User.findOne({ email });

        if (!user) {
            console.log('❌ User NOT FOUND');
            process.exit(1);
        }

        console.log(`User found: ${user.email}, Role: ${user.role}`);

        user.isVerified = true;
        user.nim = '000000000';
        user.fakultas = 'Administrator';
        user.whatsapp = '08123456789';

        await user.save();

        console.log('✅ Admin verified and profile completed.');
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

verifyAdmin();
