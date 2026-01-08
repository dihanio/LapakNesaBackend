const passport = require('passport');
const GoogleStrategy = require('passport-google-oauth20').Strategy;
const User = require('../models/User');

passport.use(
    new GoogleStrategy(
        {
            clientID: process.env.GOOGLE_CLIENT_ID,
            clientSecret: process.env.GOOGLE_CLIENT_SECRET,
            callbackURL: process.env.GOOGLE_CALLBACK_URL || 'http://localhost:5000/api/auth/google/callback',
        },
        async (accessToken, refreshToken, profile, done) => {
            try {
                const email = profile.emails[0].value;

                // Validate UNESA email domain
                if (!email.endsWith('@mhs.unesa.ac.id')) {
                    return done(null, false, {
                        message: 'Hanya email mahasiswa UNESA (@mhs.unesa.ac.id) yang diperbolehkan'
                    });
                }

                // Check if user exists
                let user = await User.findOne({ email });

                if (user) {
                    // Update Google profile info if needed
                    if (!user.googleId) {
                        user.googleId = profile.id;
                        user.avatar = profile.photos?.[0]?.value || user.avatar;
                        await user.save();
                    }
                    return done(null, user);
                }

                // Create new user
                user = await User.create({
                    googleId: profile.id,
                    email: email,
                    nama: profile.displayName,
                    avatar: profile.photos?.[0]?.value || null,
                    isVerified: false, // Need to complete profile (NIM, Fakultas)
                });

                return done(null, user);
            } catch (error) {
                return done(error, null);
            }
        }
    )
);

passport.serializeUser((user, done) => {
    done(null, user.id);
});

passport.deserializeUser(async (id, done) => {
    try {
        const user = await User.findById(id);
        done(null, user);
    } catch (error) {
        done(error, null);
    }
});

module.exports = passport;
