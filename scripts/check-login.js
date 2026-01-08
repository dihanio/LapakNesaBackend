const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');

const checkLogin = async () => {
    try {
        await connectDB();
        console.log('Connected to DB...');

        const email = 'dihaanfeu123@gmail.com';
        const password = 'Nioganteng12345';

        const user = await User.findOne({ email }).select('+password');

        if (!user) {
            console.log('❌ User NOT FOUND in DB');
            process.exit(1);
        }

        console.log(`✅ User Found: ${user.email}`);
        console.log(`   Role: ${user.role}`);
        console.log(`   Password Hash Exists: ${!!user.password}`);

        if (user.password) {
            console.log(`   Hash: ${user.password.substring(0, 10)}...`);
        }

        const isMatch = await user.matchPassword(password);

        if (isMatch) {
            console.log('✅ Password MATCHES!');
        } else {
            console.log('❌ Password DOES NOT MATCH');
        }

        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

checkLogin();
