const mongoose = require('mongoose');
const User = require('./src/models/User');

const uri = 'mongodb://localhost:27017/lapaknesa';

(async () => {
    try {
        await mongoose.connect(uri);

        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);

        console.log('--- USERS VERIFIED TODAY ---');
        const verifiedToday = await User.find({
            'verification.status': 'verified',
            'verification.verifiedAt': { $gte: startOfToday }
        }).select('nama email role verification.status verification.verifiedAt');

        console.log(`Count: ${verifiedToday.length}`);
        verifiedToday.forEach(u => console.log(`- ${u.nama} (${u.email}) | Role: ${u.role} | VerifiedAt: ${u.verification.verifiedAt}`));

        console.log('\n--- ALL SELLERS (ROLE = PENJUAL) ---');
        const allSellers = await User.find({ role: 'penjual' }).select('nama email role verification.status');
        console.log(`Count: ${allSellers.length}`);
        allSellers.forEach(u => console.log(`- ${u.nama} (${u.email}) | Role: ${u.role} | Status: ${u.verification.status}`));

        process.exit();
    } catch (e) { console.error(e); process.exit(1); }
})();
