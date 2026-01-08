# 🛍️ LapakNesa Backend

API Backend untuk **LapakNesa** - Platform jual beli khusus mahasiswa UNESA.

## 🚀 Tech Stack

- **Runtime**: Bun / Node.js
- **Framework**: Express.js
- **Database**: MongoDB (Atlas)
- **Storage**: Cloudinary
- **Auth**: JWT + Google OAuth 2.0
- **Real-time**: Socket.IO

## 📦 Instalasi

```bash
# Clone repository
git clone https://github.com/dihanio/LapakNesaBackend.git
cd LapakNesaBackend

# Install dependencies
bun install
# atau
npm install

# Setup environment
cp .env.example .env
# Edit .env dengan kredensial Anda
```

## ⚙️ Environment Variables

| Variable | Deskripsi |
|----------|-----------|
| `MONGODB_URI` | MongoDB connection string |
| `JWT_SECRET` | Secret key untuk JWT (min 32 karakter) |
| `CLOUDINARY_CLOUD_NAME` | Cloudinary cloud name |
| `CLOUDINARY_API_KEY` | Cloudinary API key |
| `CLOUDINARY_API_SECRET` | Cloudinary API secret |
| `GOOGLE_CLIENT_ID` | Google OAuth client ID |
| `GOOGLE_CLIENT_SECRET` | Google OAuth client secret |
| `GOOGLE_CALLBACK_URL` | OAuth callback URL |
| `FRONTEND_URL` | URL frontend untuk redirect |
| `ALLOWED_ORIGINS` | CORS allowed origins (comma-separated) |

## 🏃 Menjalankan

```bash
# Development
bun dev

# Production
bun start
```

Server akan berjalan di `http://localhost:5000`

## 📁 Struktur Folder

```
src/
├── config/         # Database & Cloudinary config
├── controllers/    # Request handlers
├── middleware/     # Auth, upload, rate limiting
├── models/         # Mongoose schemas
├── routes/         # API routes
├── services/       # Business logic
└── utils/          # Helper functions
```

## 🔗 API Endpoints

| Method | Endpoint | Deskripsi |
|--------|----------|-----------|
| GET | `/api/health` | Health check |
| POST | `/api/auth/google` | Google OAuth login |
| GET | `/api/products` | Daftar produk |
| POST | `/api/products` | Tambah produk |
| GET | `/api/chat/conversations` | Daftar chat |

## 🚢 Deployment (Render)

1. Buat Web Service baru di [Render](https://render.com)
2. Connect ke repository ini
3. Build Command: `npm install`
4. Start Command: `npm start`
5. Tambahkan semua environment variables

## 📄 License

MIT License - Dibuat dengan ❤️ oleh Tim LapakNesa UNESA
