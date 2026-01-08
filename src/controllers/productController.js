const Product = require('../models/Product');
const UserInteraction = require('../models/UserInteraction');
const recommendationService = require('../services/recommendationService');
const activityLogService = require('../services/activityLogService');

// @desc    Get all products
// @route   GET /api/products
// @access  Public
const getProducts = async (req, res) => {
    try {
        const { kategori, kondisi, search, sort, page = 1, limit = 100, penjual } = req.query;

        // Build query - only show approved products publicly
        let query = { status: 'tersedia', approvalStatus: 'approved' };

        // Filter by seller if provided
        if (penjual) {
            query.penjual = penjual;
            // When filtering by seller, also show sold products
            delete query.status;
        }

        if (kategori) {
            query.kategori = String(kategori);
        }

        if (kondisi) {
            query.kondisi = String(kondisi);
        }

        if (search) {
            query.$text = { $search: String(search) };
        }

        // Build sort
        let sortOption = { createdAt: -1 }; // Default: newest first
        if (sort === 'price_asc') sortOption = { harga: 1 };
        if (sort === 'price_desc') sortOption = { harga: -1 };
        if (sort === 'oldest') sortOption = { createdAt: 1 };

        // Pagination
        const pageNum = parseInt(page, 10) || 1;
        const limitNum = parseInt(limit, 10) || 100;
        const skip = (pageNum - 1) * limitNum;

        // Get total count for pagination info
        const total = await Product.countDocuments(query);
        const totalPages = Math.ceil(total / limitNum);

        const products = await Product.find(query)
            .populate('penjual', 'nama fakultas avatar verification role')
            .sort(sortOption)
            .skip(skip)
            .limit(limitNum);

        res.json({
            success: true,
            count: products.length,
            data: products,
            pagination: {
                page: pageNum,
                limit: limitNum,
                total,
                totalPages,
                hasMore: pageNum < totalPages
            }
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get single product
// @route   GET /api/products/:id
// @access  Public
const getProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id)
            .populate('penjual', 'nama email fakultas jurusan avatar verification role');

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Create product
// @route   POST /api/products
// @access  Private (penjual only)
const createProduct = async (req, res) => {
    try {
        // Prevent admin/super_admin from creating products
        if (req.user.role === 'admin' || req.user.role === 'super_admin') {
            return res.status(403).json({
                success: false,
                message: 'Admin tidak diizinkan untuk menjual produk',
            });
        }

        const {
            namaBarang, harga, kategori, kondisi, deskripsi, lokasi, stok,
            tipeTransaksi,
            // Category details sent as JSON strings
            foodDetails, elektronikDetails, fashionDetails, bukuDetails,
            otomotifDetails, jasaDetails, perabotanDetails, rentalDetails
        } = req.body;

        // Handle file path - could be Cloudinary URL or local path
        let gambarPath = '';
        if (req.file) {
            gambarPath = req.file.path.startsWith('http')
                ? req.file.path
                : `/uploads/${req.file.filename}`;
        }

        // Parse JSON details safely
        const parseJSON = (str) => {
            if (!str) return null;
            try {
                return typeof str === 'string' ? JSON.parse(str) : str;
            } catch {
                return null;
            }
        };

        // Build product data
        const productData = {
            namaBarang,
            harga,
            kategori,
            kondisi,
            deskripsi,
            lokasi,
            gambar: gambarPath,
            penjual: req.user._id,
            stok: parseInt(stok) || 1,
            tipeTransaksi: tipeTransaksi || 'jual',

            // Auto-approve per user request
            approvalStatus: 'approved',
            approvedAt: new Date(),
        };

        // Add category-specific details
        if (kategori === 'Makanan') {
            const parsed = parseJSON(foodDetails);
            if (parsed) {
                productData.foodDetails = {
                    expiry: parsed.expiry || null,
                    isHalal: parsed.isHalal !== false,
                    portion: parsed.portion || '',
                    isPreOrder: parsed.isPreOrder || false,
                };
            }
        }

        if (kategori === 'Elektronik') {
            const parsed = parseJSON(elektronikDetails);
            if (parsed) {
                productData.elektronikDetails = {
                    brand: parsed.brand || '',
                    warranty: parsed.warranty || '',
                    specs: parsed.specs || '',
                };
            }
        }

        if (kategori === 'Fashion') {
            const parsed = parseJSON(fashionDetails);
            if (parsed) {
                productData.fashionDetails = {
                    size: parsed.size || '',
                    color: parsed.color || '',
                    brand: parsed.brand || '',
                    material: parsed.material || '',
                };
            }
        }

        if (kategori === 'Buku') {
            const parsed = parseJSON(bukuDetails);
            if (parsed) {
                productData.bukuDetails = {
                    author: parsed.author || '',
                    publisher: parsed.publisher || '',
                    year: parsed.year || null,
                    isbn: parsed.isbn || '',
                };
            }
        }

        if (kategori === 'Otomotif') {
            const parsed = parseJSON(otomotifDetails);
            if (parsed) {
                productData.otomotifDetails = {
                    tipeOtomotif: parsed.tipeOtomotif || 'kendaraan',
                    // Kendaraan fields
                    brand: parsed.brand || '',
                    year: parsed.year || null,
                    transmission: parsed.transmission || '',
                    cc: parsed.cc || null,
                    // Sparepart fields
                    jenisPart: parsed.jenisPart || '',
                    kompatibel: parsed.kompatibel || '',
                    kondisiPart: parsed.kondisiPart || '',
                    // Aksesoris fields
                    jenisAksesoris: parsed.jenisAksesoris || '',
                    ukuran: parsed.ukuran || '',
                };
            }
        }

        if (kategori === 'Jasa') {
            const parsed = parseJSON(jasaDetails);
            if (parsed) {
                productData.jasaDetails = {
                    serviceType: parsed.serviceType || '',
                    availability: parsed.availability || '',
                    duration: parsed.duration || '',
                    experience: parsed.experience || '',
                    priceType: parsed.priceType || 'per jam',
                };
            }
        }

        if (kategori === 'Perabotan') {
            const parsed = parseJSON(perabotanDetails);
            if (parsed) {
                productData.perabotanDetails = {
                    dimensions: parsed.dimensions || '',
                    material: parsed.material || '',
                    weight: parsed.weight || '',
                };
            }
        }

        // Add rental details if tipeTransaksi is 'sewa'
        if (tipeTransaksi === 'sewa') {
            const parsed = parseJSON(rentalDetails);
            if (parsed) {
                productData.rentalDetails = {
                    pricePerDay: parsed.pricePerDay || null,
                    pricePerWeek: parsed.pricePerWeek || null,
                    pricePerMonth: parsed.pricePerMonth || null,
                    deposit: parsed.deposit || null,
                    minDuration: parsed.minDuration || null,
                    maxDuration: parsed.maxDuration || null,
                };
            }
        }

        const product = await Product.create(productData);

        // Log product creation
        await activityLogService.logProductCreated(
            req.user._id,
            req.user.role,
            product._id,
            { namaBarang: product.namaBarang, harga: product.harga, kategori: product.kategori },
            req
        );

        res.status(201).json({
            success: true,
            data: product,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Update product
// @route   PUT /api/products/:id
// @access  Private
const updateProduct = async (req, res) => {
    try {
        let product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        // Check ownership
        if (product.penjual.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak memiliki akses untuk mengubah produk ini',
            });
        }

        // Prevent editing sold products (except status changes)
        if (product.status === 'terjual') {
            const allowedFields = ['status'];
            const attemptedFields = Object.keys(req.body).filter(key => !allowedFields.includes(key));
            if (attemptedFields.length > 0 || req.file) {
                return res.status(400).json({
                    success: false,
                    message: 'Produk yang sudah terjual tidak dapat diedit',
                });
            }
        }

        // Parse JSON details safely
        const parseJSON = (str) => {
            if (!str) return null;
            try {
                return typeof str === 'string' ? JSON.parse(str) : str;
            } catch {
                return null;
            }
        };

        const updateData = { ...req.body };

        // Logic for Discount/Strikethrough Price
        if (updateData.harga !== undefined) {
            const newPrice = Number(updateData.harga);
            const currentPrice = Number(product.harga);
            const currentOriginal = product.originalPrice ? Number(product.originalPrice) : null;

            if (newPrice < currentPrice) {
                // Price is being lowered
                if (!currentOriginal) {
                    // First time discount: store the old price as original
                    updateData.originalPrice = currentPrice;
                }
                // If there was already an originalPrice (e.g. 50k), and we lower from 40k to 30k,
                // we keep 50k as the anchor high price to show bigger discount.
            } else if (newPrice > currentPrice) {
                // Price is being raised
                if (currentOriginal && newPrice >= currentOriginal) {
                    // Price restored to original or higher: remove discount
                    updateData.originalPrice = null;
                }
                // If raised but still below original (e.g. 30k -> 40k, orig 50k), keep discount
            }
        }

        // Handle file upload
        if (req.file) {
            updateData.gambar = req.file.path.startsWith('http')
                ? req.file.path
                : `/uploads/${req.file.filename}`;
        }

        // Handle stok
        if (updateData.stok) {
            updateData.stok = parseInt(updateData.stok) || 1;
        }

        // Handle category-specific details
        const kategori = updateData.kategori || product.kategori;

        if (kategori === 'Makanan' && updateData.foodDetails) {
            const parsed = parseJSON(updateData.foodDetails);
            if (parsed) {
                updateData.foodDetails = {
                    expiry: parsed.expiry || null,
                    isHalal: parsed.isHalal !== false,
                    portion: parsed.portion || '',
                    isPreOrder: parsed.isPreOrder || false,
                };
            }
        }

        if (kategori === 'Elektronik' && updateData.elektronikDetails) {
            const parsed = parseJSON(updateData.elektronikDetails);
            if (parsed) {
                updateData.elektronikDetails = {
                    brand: parsed.brand || '',
                    warranty: parsed.warranty || '',
                    specs: parsed.specs || '',
                };
            }
        }

        if (kategori === 'Fashion' && updateData.fashionDetails) {
            const parsed = parseJSON(updateData.fashionDetails);
            if (parsed) {
                updateData.fashionDetails = {
                    size: parsed.size || '',
                    color: parsed.color || '',
                    brand: parsed.brand || '',
                    material: parsed.material || '',
                };
            }
        }

        if (kategori === 'Buku' && updateData.bukuDetails) {
            const parsed = parseJSON(updateData.bukuDetails);
            if (parsed) {
                updateData.bukuDetails = {
                    author: parsed.author || '',
                    publisher: parsed.publisher || '',
                    year: parsed.year || null,
                    isbn: parsed.isbn || '',
                };
            }
        }

        if (kategori === 'Otomotif' && updateData.otomotifDetails) {
            const parsed = parseJSON(updateData.otomotifDetails);
            if (parsed) {
                updateData.otomotifDetails = {
                    tipeOtomotif: parsed.tipeOtomotif || 'kendaraan',
                    // Kendaraan fields
                    brand: parsed.brand || '',
                    year: parsed.year || null,
                    transmission: parsed.transmission || '',
                    cc: parsed.cc || null,
                    // Sparepart fields
                    jenisPart: parsed.jenisPart || '',
                    kompatibel: parsed.kompatibel || '',
                    kondisiPart: parsed.kondisiPart || '',
                    // Aksesoris fields
                    jenisAksesoris: parsed.jenisAksesoris || '',
                    ukuran: parsed.ukuran || '',
                };
            }
        }

        if (kategori === 'Jasa' && updateData.jasaDetails) {
            const parsed = parseJSON(updateData.jasaDetails);
            if (parsed) {
                updateData.jasaDetails = {
                    serviceType: parsed.serviceType || '',
                    availability: parsed.availability || '',
                    duration: parsed.duration || '',
                    experience: parsed.experience || '',
                    priceType: parsed.priceType || 'per jam',
                };
            }
        }

        if (kategori === 'Perabotan' && updateData.perabotanDetails) {
            const parsed = parseJSON(updateData.perabotanDetails);
            if (parsed) {
                updateData.perabotanDetails = {
                    dimensions: parsed.dimensions || '',
                    material: parsed.material || '',
                    weight: parsed.weight || '',
                };
            }
        }

        // Handle rental details
        const tipeTransaksi = updateData.tipeTransaksi || product.tipeTransaksi;
        if (tipeTransaksi === 'sewa' && updateData.rentalDetails) {
            const parsed = parseJSON(updateData.rentalDetails);
            if (parsed) {
                updateData.rentalDetails = {
                    pricePerDay: parsed.pricePerDay || null,
                    pricePerWeek: parsed.pricePerWeek || null,
                    pricePerMonth: parsed.pricePerMonth || null,
                    deposit: parsed.deposit || null,
                    minDuration: parsed.minDuration || null,
                    maxDuration: parsed.maxDuration || null,
                };
            }
        }

        product = await Product.findByIdAndUpdate(req.params.id, updateData, {
            new: true,
            runValidators: true,
        });

        // Log product update
        await activityLogService.logProductUpdated(
            req.user._id,
            req.user.role,
            product._id,
            { namaBarang: product.namaBarang, updatedFields: Object.keys(updateData) },
            req
        );

        res.json({
            success: true,
            data: product,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Delete product
// @route   DELETE /api/products/:id
// @access  Private
const deleteProduct = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        // Check ownership
        if (product.penjual.toString() !== req.user._id.toString()) {
            return res.status(403).json({
                success: false,
                message: 'Anda tidak memiliki akses untuk menghapus produk ini',
            });
        }

        // Prevent deleting sold products
        if (product.status === 'terjual') {
            return res.status(400).json({
                success: false,
                message: 'Produk yang sudah terjual tidak dapat dihapus',
            });
        }

        // Store product info before deletion for logging
        const productInfo = { namaBarang: product.namaBarang, kategori: product.kategori };

        await product.deleteOne();

        // Log product deletion
        await activityLogService.logProductDeleted(
            req.user._id,
            req.user.role,
            req.params.id,
            productInfo,
            req
        );

        res.json({
            success: true,
            message: 'Produk berhasil dihapus',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get my products
// @route   GET /api/products/my
// @access  Private
const getMyProducts = async (req, res) => {
    try {
        const products = await Product.find({ penjual: req.user._id })
            .sort({ createdAt: -1 });

        res.json({
            success: true,
            count: products.length,
            data: products,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get recommended products
// @route   GET /api/products/recommended
// @access  Public (personalized if authenticated)
const getRecommendedProducts = async (req, res) => {
    try {
        const { limit = 20 } = req.query;
        const limitNum = Math.min(parseInt(limit, 10) || 20, 50);

        let products;
        if (req.user) {
            // Personalized recommendations for logged-in users
            products = await recommendationService.getPersonalizedRecommendations(
                req.user._id,
                limitNum
            );
        } else {
            // Trending products for guest users
            products = await recommendationService.getTrendingProducts(limitNum);
        }

        res.json({
            success: true,
            count: products.length,
            data: products,
            isPersonalized: !!req.user,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Track product view
// @route   POST /api/products/:id/view
// @access  Private
const trackProductView = async (req, res) => {
    try {
        const product = await Product.findById(req.params.id);

        if (!product) {
            return res.status(404).json({
                success: false,
                message: 'Produk tidak ditemukan',
            });
        }

        // Track the interaction
        await recommendationService.trackInteraction(
            req.user._id,
            product._id,
            'view',
            product.kategori
        );

        res.json({
            success: true,
            message: 'View tracked',
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

// @desc    Get recently viewed products
// @route   GET /api/products/recently-viewed
// @access  Private
const getRecentlyViewed = async (req, res) => {
    try {
        const { limit = 10 } = req.query;
        const limitNum = Math.min(parseInt(limit, 10) || 10, 20);

        // Get user's recent product views (distinct products, sorted by most recent)
        const interactions = await UserInteraction.aggregate([
            { $match: { user: req.user._id, type: 'view' } },
            { $sort: { createdAt: -1 } },
            {
                $group: {
                    _id: '$product',
                    lastViewed: { $first: '$createdAt' }
                }
            },
            { $sort: { lastViewed: -1 } },
            { $limit: limitNum }
        ]);

        const productIds = interactions.map(i => i._id);

        // Fetch product details
        const products = await Product.find({
            _id: { $in: productIds },
            status: 'tersedia' // Only show available products
        })
            .populate('penjual', 'nama fakultas avatar')
            .lean();

        // Sort products by the order from interactions (most recently viewed first)
        const productMap = new Map(products.map(p => [p._id.toString(), p]));
        const sortedProducts = productIds
            .map(id => productMap.get(id.toString()))
            .filter(Boolean);

        res.json({
            success: true,
            count: sortedProducts.length,
            data: sortedProducts,
        });
    } catch (error) {
        console.error(error);
        res.status(500).json({
            success: false,
            message: error.message || 'Terjadi kesalahan server',
        });
    }
};

module.exports = {
    getProducts,
    getProduct,
    createProduct,
    updateProduct,
    deleteProduct,
    getMyProducts,
    getRecommendedProducts,
    trackProductView,
    getRecentlyViewed,
};
