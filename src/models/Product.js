const mongoose = require('mongoose');

const productSchema = new mongoose.Schema({
    namaBarang: {
        type: String,
        required: [true, 'Nama barang wajib diisi'],
        trim: true,
    },
    harga: {
        type: Number,
        required: [true, 'Harga wajib diisi'],
        min: [0, 'Harga tidak boleh negatif'],
    },
    originalPrice: {
        type: Number,
    },
    kategori: {
        type: String,
        required: [true, 'Kategori wajib dipilih'],
        enum: {
            values: ['Buku', 'Elektronik', 'Perabotan', 'Fashion', 'Alat Kuliah', 'Olahraga', 'Otomotif', 'Makanan', 'Hobi', 'Jasa', 'Lainnya'],
            message: 'Kategori tidak valid',
        },
    },
    kondisi: {
        type: String,
        required: [true, 'Kondisi barang wajib dipilih'],
        enum: {
            values: ['Baru', 'Seperti Baru', 'Bekas - Mulus', 'Lecet Pemakaian', 'Baru Dibuat', 'Pre-order', 'Tersedia', 'Booking'],
            message: 'Kondisi tidak valid',
        },
    },
    // Tipe Transaksi: Jual, Sewa, atau Jasa
    tipeTransaksi: {
        type: String,
        enum: ['jual', 'sewa', 'jasa'],
        default: 'jual',
    },
    deskripsi: {
        type: String,
        trim: true,
        maxlength: [1000, 'Deskripsi maksimal 1000 karakter'],
    },
    gambar: {
        type: String,
        default: '',
    },
    lokasi: {
        type: String,
        default: 'Kampus UNESA',
    },
    penjual: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
    },
    status: {
        type: String,
        enum: ['tersedia', 'terjual', 'disewa'],
        default: 'tersedia',
    },
    // Admin approval workflow
    approvalStatus: {
        type: String,
        enum: ['pending', 'approved', 'rejected'],
        default: 'pending',
    },
    approvalNotes: {
        type: String,
        default: null,
    },
    approvedAt: {
        type: Date,
        default: null,
    },
    approvedBy: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        default: null,
    },
    // Stock management
    stok: {
        type: Number,
        default: 1,
        min: [0, 'Stok tidak boleh negatif'],
    },
    // Popularity tracking for recommendations
    viewCount: {
        type: Number,
        default: 0,
    },
    wishlistCount: {
        type: Number,
        default: 0,
    },
    popularityScore: {
        type: Number,
        default: 0,
    },

    // ======= DETAIL SEWA (Rental) =======
    rentalDetails: {
        pricePerDay: { type: Number },      // Harga sewa per hari
        pricePerWeek: { type: Number },     // Harga sewa per minggu
        pricePerMonth: { type: Number },    // Harga sewa per bulan
        deposit: { type: Number },           // Deposit yang diperlukan
        minDuration: { type: Number },       // Minimal durasi sewa (hari)
        maxDuration: { type: Number },       // Maksimal durasi sewa (hari)
        availableFrom: { type: Date },       // Tersedia dari tanggal
        availableUntil: { type: Date },      // Tersedia sampai tanggal
    },

    // ======= DETAIL KATEGORI MAKANAN =======
    foodDetails: {
        expiry: { type: Date },              // Tanggal kadaluarsa
        isHalal: { type: Boolean, default: true },
        portion: { type: String },           // per pcs, per pack, per box
        isPreOrder: { type: Boolean, default: false },
        preparationTime: { type: String },   // waktu persiapan untuk pre-order
    },

    // ======= DETAIL KATEGORI ELEKTRONIK =======
    elektronikDetails: {
        brand: { type: String },
        warranty: { type: String },          // Garansi (misal: 6 bulan, 1 tahun)
        specs: { type: String },             // Spesifikasi singkat
    },

    // ======= DETAIL KATEGORI FASHION =======
    fashionDetails: {
        size: { type: String },              // S, M, L, XL, XXL, atau angka
        color: { type: String },
        brand: { type: String },
        material: { type: String },          // Bahan (cotton, polyester, dll)
    },

    // ======= DETAIL KATEGORI BUKU =======
    bukuDetails: {
        author: { type: String },            // Penulis
        publisher: { type: String },         // Penerbit
        year: { type: Number },              // Tahun terbit
        isbn: { type: String },
    },

    // ======= DETAIL KATEGORI OTOMOTIF =======
    otomotifDetails: {
        tipeOtomotif: { type: String, enum: ['kendaraan', 'sparepart', 'aksesoris'] }, // Kendaraan, Sparepart, atau Aksesoris
        // Fields untuk Kendaraan
        brand: { type: String },
        year: { type: Number },              // Tahun produksi
        transmission: { type: String },      // Manual/Matic
        cc: { type: Number },                // CC mesin
        platNomor: { type: String },         // Plat nomor (opsional)
        // Fields untuk Sparepart
        jenisPart: { type: String },         // Mesin, Body, Elektrik
        kompatibel: { type: String },        // Kompatibel dengan kendaraan apa
        kondisiPart: { type: String },       // OEM, Aftermarket, KW
        // Fields untuk Aksesoris
        jenisAksesoris: { type: String },    // Helm, Jaket, Sarung Tangan, dll
        ukuran: { type: String },            // S, M, L, XL atau angka
    },

    // ======= DETAIL KATEGORI JASA =======
    jasaDetails: {
        serviceType: { type: String },       // Jenis jasa (les privat, desain, jasa antar, dll)
        availability: { type: String },      // Ketersediaan (weekday, weekend, 24 jam, dll)
        duration: { type: String },          // Durasi per sesi
        experience: { type: String },        // Pengalaman
        priceType: { type: String },         // per jam, per project, per hari
    },

    // ======= DETAIL KATEGORI PERABOTAN =======
    perabotanDetails: {
        dimensions: { type: String },        // Ukuran (PxLxT)
        material: { type: String },          // Bahan
        weight: { type: String },            // Berat
    },

    // Marker for seeded/dummy data
    isDummy: {
        type: Boolean,
        default: false,
    },
}, {
    timestamps: true,
});

// Index for search
productSchema.index({ namaBarang: 'text', deskripsi: 'text' });

module.exports = mongoose.model('Product', productSchema);
