const Product = require('../models/Product');
const UserInteraction = require('../models/UserInteraction');
const Wishlist = require('../models/Wishlist');
const User = require('../models/User');

// Scoring weights
const WEIGHTS = {
    RECENCY: 0.30,        // 30% - New products get boost
    POPULARITY: 0.25,     // 25% - Based on views & wishlist
    CATEGORY_MATCH: 0.20, // 20% - User's preferred categories
    SELLER_TRUST: 0.15,   // 15% - Verified & followed sellers
    FRESHNESS: 0.10,      // 10% - Gradual decay for old products
};

// Time constants
const ONE_DAY_MS = 24 * 60 * 60 * 1000;
const RECENCY_BOOST_DAYS = 7;
const FRESHNESS_DECAY_DAYS = 30;

/**
 * Calculate recency score (0-1)
 * Products less than 7 days old get maximum score
 */
const calculateRecencyScore = (createdAt) => {
    const ageInDays = (Date.now() - new Date(createdAt).getTime()) / ONE_DAY_MS;
    if (ageInDays <= RECENCY_BOOST_DAYS) {
        return 1 - (ageInDays / RECENCY_BOOST_DAYS) * 0.3; // 0.7-1.0 for new products
    }
    return Math.max(0.3, 0.7 - (ageInDays - RECENCY_BOOST_DAYS) / 100);
};

/**
 * Calculate popularity score (0-1)
 * Based on view count and wishlist count
 */
const calculatePopularityScore = (viewCount, wishlistCount, maxViews, maxWishlists) => {
    const normalizedViews = maxViews > 0 ? viewCount / maxViews : 0;
    const normalizedWishlists = maxWishlists > 0 ? wishlistCount / maxWishlists : 0;
    // Wishlist is weighted more heavily as it indicates stronger interest
    return normalizedViews * 0.4 + normalizedWishlists * 0.6;
};

/**
 * Calculate freshness decay (0-1)
 * Products older than 30 days start losing score
 */
const calculateFreshnessScore = (createdAt) => {
    const ageInDays = (Date.now() - new Date(createdAt).getTime()) / ONE_DAY_MS;
    if (ageInDays <= FRESHNESS_DECAY_DAYS) {
        return 1;
    }
    return Math.max(0.1, 1 - (ageInDays - FRESHNESS_DECAY_DAYS) / 180);
};

/**
 * Get user's preferred categories based on interaction history
 */
const getUserPreferredCategories = async (userId) => {
    const interactions = await UserInteraction.aggregate([
        { $match: { user: userId } },
        { $group: { _id: '$kategori', count: { $sum: 1 } } },
        { $sort: { count: -1 } },
        { $limit: 5 }
    ]);
    return interactions.map(i => ({ kategori: i._id, weight: i.count }));
};

/**
 * Get IDs of sellers that the user follows
 */
const getFollowedSellerIds = async (userId) => {
    const user = await User.findById(userId).select('following');
    return user?.following || [];
};

/**
 * Track user interaction with a product
 */
const trackInteraction = async (userId, productId, type, kategori) => {
    try {
        // Don't track duplicate views within 1 hour
        if (type === 'view') {
            const recentView = await UserInteraction.findOne({
                user: userId,
                product: productId,
                type: 'view',
                createdAt: { $gte: new Date(Date.now() - 60 * 60 * 1000) }
            });
            if (recentView) return null;
        }

        const interaction = await UserInteraction.create({
            user: userId,
            product: productId,
            type,
            kategori,
        });

        // Increment view count on product
        if (type === 'view') {
            await Product.findByIdAndUpdate(productId, { $inc: { viewCount: 1 } });
        }

        return interaction;
    } catch (error) {
        console.error('Error tracking interaction:', error);
        return null;
    }
};

/**
 * Get personalized recommendations for logged-in users
 */
const getPersonalizedRecommendations = async (userId, limit = 20) => {
    try {
        // Get user preferences
        const [preferredCategories, followedSellers] = await Promise.all([
            getUserPreferredCategories(userId),
            getFollowedSellerIds(userId),
        ]);

        // Get all available products
        const products = await Product.find({
            status: 'tersedia',
            approvalStatus: 'approved',
        })
            .populate('penjual', 'nama fakultas avatar verification followersCount')
            .lean();

        if (products.length === 0) return [];

        // Get max values for normalization
        const maxViews = Math.max(...products.map(p => p.viewCount || 0), 1);
        const maxWishlists = Math.max(...products.map(p => p.wishlistCount || 0), 1);

        // Create category weight map
        const categoryWeights = {};
        const maxCategoryWeight = preferredCategories[0]?.weight || 1;
        preferredCategories.forEach(c => {
            categoryWeights[c.kategori] = c.weight / maxCategoryWeight;
        });

        // Create followed seller set for O(1) lookup
        const followedSellerSet = new Set(followedSellers.map(id => id.toString()));

        // Score each product
        const scoredProducts = products.map(product => {
            const recencyScore = calculateRecencyScore(product.createdAt);
            const popularityScore = calculatePopularityScore(
                product.viewCount || 0,
                product.wishlistCount || 0,
                maxViews,
                maxWishlists
            );
            const categoryScore = categoryWeights[product.kategori] || 0.1;
            const freshnessScore = calculateFreshnessScore(product.createdAt);

            // Seller trust score
            let sellerTrustScore = 0.3; // Base score
            if (product.penjual) {
                if (product.penjual.verification?.status === 'verified') {
                    sellerTrustScore += 0.3;
                }
                if (followedSellerSet.has(product.penjual._id.toString())) {
                    sellerTrustScore += 0.4; // Big boost for followed sellers
                }
            }

            // Calculate final score
            const finalScore =
                recencyScore * WEIGHTS.RECENCY +
                popularityScore * WEIGHTS.POPULARITY +
                categoryScore * WEIGHTS.CATEGORY_MATCH +
                sellerTrustScore * WEIGHTS.SELLER_TRUST +
                freshnessScore * WEIGHTS.FRESHNESS;

            return {
                ...product,
                _recommendationScore: finalScore,
            };
        });

        // Sort by score and add some randomization for variety
        scoredProducts.sort((a, b) => {
            // Add small random factor (±5%) to prevent stale ordering
            const randomFactorA = 1 + (Math.random() - 0.5) * 0.1;
            const randomFactorB = 1 + (Math.random() - 0.5) * 0.1;
            return (b._recommendationScore * randomFactorB) - (a._recommendationScore * randomFactorA);
        });

        return scoredProducts.slice(0, limit);
    } catch (error) {
        console.error('Error getting personalized recommendations:', error);
        return getTrendingProducts(limit);
    }
};

/**
 * Get trending products for guest users
 */
const getTrendingProducts = async (limit = 20) => {
    try {
        const products = await Product.find({ status: 'tersedia', approvalStatus: 'approved' })
            .populate('penjual', 'nama fakultas avatar verification')
            .lean();

        if (products.length === 0) return [];

        // Get max values for normalization
        const maxViews = Math.max(...products.map(p => p.viewCount || 0), 1);
        const maxWishlists = Math.max(...products.map(p => p.wishlistCount || 0), 1);

        // Score products based on trending factors
        const scoredProducts = products.map(product => {
            const recencyScore = calculateRecencyScore(product.createdAt);
            const popularityScore = calculatePopularityScore(
                product.viewCount || 0,
                product.wishlistCount || 0,
                maxViews,
                maxWishlists
            );
            const freshnessScore = calculateFreshnessScore(product.createdAt);

            // Seller trust score for guest
            let sellerTrustScore = 0.5;
            if (product.penjual?.verification?.status === 'verified') {
                sellerTrustScore = 1;
            }

            // Trending score (simplified for guests)
            const trendingScore =
                recencyScore * 0.35 +
                popularityScore * 0.35 +
                sellerTrustScore * 0.15 +
                freshnessScore * 0.15;

            return {
                ...product,
                _recommendationScore: trendingScore,
            };
        });

        // Sort with small randomization
        scoredProducts.sort((a, b) => {
            const randomFactorA = 1 + (Math.random() - 0.5) * 0.1;
            const randomFactorB = 1 + (Math.random() - 0.5) * 0.1;
            return (b._recommendationScore * randomFactorB) - (a._recommendationScore * randomFactorA);
        });

        return scoredProducts.slice(0, limit);
    } catch (error) {
        console.error('Error getting trending products:', error);
        // Fallback to newest products
        return Product.find({ status: 'tersedia' })
            .populate('penjual', 'nama fakultas avatar')
            .sort({ createdAt: -1 })
            .limit(limit)
            .lean();
    }
};

/**
 * Update wishlist count on a product
 */
const updateWishlistCount = async (productId) => {
    try {
        const count = await Wishlist.countDocuments({ product: productId });
        await Product.findByIdAndUpdate(productId, { wishlistCount: count });
        return count;
    } catch (error) {
        console.error('Error updating wishlist count:', error);
        return 0;
    }
};

/**
 * Recalculate popularity scores for all products (for scheduled job)
 */
const recalculateAllPopularityScores = async () => {
    try {
        const products = await Product.find({ status: 'tersedia' });

        const maxViews = Math.max(...products.map(p => p.viewCount || 0), 1);
        const maxWishlists = Math.max(...products.map(p => p.wishlistCount || 0), 1);

        const updates = products.map(product => ({
            updateOne: {
                filter: { _id: product._id },
                update: {
                    popularityScore: calculatePopularityScore(
                        product.viewCount || 0,
                        product.wishlistCount || 0,
                        maxViews,
                        maxWishlists
                    )
                }
            }
        }));

        await Product.bulkWrite(updates);
        console.log(`Updated popularity scores for ${products.length} products`);
    } catch (error) {
        console.error('Error recalculating popularity scores:', error);
    }
};

module.exports = {
    trackInteraction,
    getPersonalizedRecommendations,
    getTrendingProducts,
    updateWishlistCount,
    recalculateAllPopularityScores,
    WEIGHTS,
};
