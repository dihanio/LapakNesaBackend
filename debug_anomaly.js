const mongoose = require('mongoose');
const User = require('./src/models/User');

const uri = 'mongodb://localhost:27017/lapaknesa';

(async () => {
    try {
        await mongoose.connect(uri);

        console.log('--- VERIFIED BUT NOT SELLER ---');
        const anomaly = await User.find({
            'verification.status': 'verified',
            role: { $ne: 'penjual' }
        }).select('nama email role verification.status');

        console.log(`Count: ${anomaly.length}`);
        anomaly.forEach(u => console.log(`- ${u.nama} (${u.email}) | Role: ${u.role}`));

        // Also check count of verified today again just to be sure
        const startOfToday = new Date();
        startOfToday.setHours(0, 0, 0, 0);
        const verifiedToday = await User.countDocuments({
            'verification.status': 'verified',
            'verification.verifiedAt': { $gte: startOfToday }
        });
        console.log('Verified Today Count (via countDocuments):', verifiedToday);

        process.exit();
    } catch (e) { console.error(e); process.exit(1); }
})();
