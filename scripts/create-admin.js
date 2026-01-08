const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../.env') });
const mongoose = require('mongoose');
const User = require('../src/models/User');
const connectDB = require('../src/config/db');

const args = process.argv.slice(2);
const email = args[0];

if (!email) {
    console.log('Usage: node scripts/create-admin.js <email>');
    process.exit(1);
}

const makeAdmin = async () => {
    try {
        await connectDB();

        const user = await User.findOne({ email });

        if (!user) {
            console.log(`User with email ${email} not found.`);
            process.exit(1);
        }

        user.role = 'admin';
        await user.save();

        console.log(`✅ Success! User ${user.nama} (${email}) is now an Admin.`);
        process.exit(0);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
};

makeAdmin();
