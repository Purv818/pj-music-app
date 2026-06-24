# PJ Music App — Setup & Build Guide

## Prerequisites

| Tool | Version | Install |
|---|---|---|
| Node.js | 18+ | https://nodejs.org |
| npm | 9+ | bundled with Node.js |
| MongoDB | 6+ | https://www.mongodb.com or Atlas |
| Android Studio | Hedgehog+ | https://developer.android.com/studio |
| Java JDK | 17+ | bundled with Android Studio |

---

## 1. Backend Setup

```bash
cd pj-music-app/backend

# Install dependencies
npm install

# Copy environment config
cp .env.example .env
# On Windows: copy .env.example .env

# Edit .env with your values:
# - MONGODB_URI: your MongoDB connection string
# - JWT_SECRET: generate with: node -e "console.log(require('crypto').randomBytes(64).toString('hex'))"
# - JWT_REFRESH_SECRET: same as above but different value
# - EMAIL_* settings for password reset emails

# Start development server (with auto-reload)
npm run dev

# Or start production server
npm start
```

The API server starts on **http://localhost:5000**

### MongoDB Setup Options

**Option A: Local MongoDB**
```bash
# Install MongoDB Community Edition from https://www.mongodb.com/try/download/community
# Start MongoDB service
mongod --dbpath /data/db
# On Windows: mongod --dbpath C:\data\db
```

**Option B: MongoDB Atlas (Cloud — recommended)**
1. Create a free cluster at https://cloud.mongodb.com
2. Create a database user and whitelist your IP
3. Copy the connection string and set it as `MONGODB_URI` in `.env`:
   ```
   MONGODB_URI=mongodb+srv://<user>:<pass>@cluster0.xxx.mongodb.net/pj_music_app?retryWrites=true&w=majority
   ```

### Environment Variables Reference

```env
NODE_ENV=development          # development | production
PORT=5000                     # HTTP server port
MONGODB_URI=mongodb://...     # MongoDB connection string
JWT_SECRET=<64-char hex>      # Access token signing secret
JWT_EXPIRES_IN=15m            # Access token TTL
JWT_REFRESH_SECRET=<64-char>  # Refresh token signing secret
JWT_REFRESH_EXPIRES_IN=7d     # Refresh token TTL
EMAIL_HOST=smtp.gmail.com     # SMTP server
EMAIL_PORT=587                # 587 for TLS, 465 for SSL
EMAIL_USER=your@gmail.com     # SMTP username
EMAIL_PASS=your_app_password  # SMTP password (use App Password for Gmail)
EMAIL_FROM=noreply@app.com    # From address
BCRYPT_ROUNDS=12              # bcrypt cost factor (10–14 recommended)
ALLOWED_ORIGINS=http://localhost:3000,capacitor://localhost
RATE_LIMIT_WINDOW_MS=900000   # 15 minutes
RATE_LIMIT_MAX=100
AUTH_RATE_LIMIT_MAX=10
```

### Gmail App Password Setup
Gmail requires an App Password (not your regular password):
1. Go to https://myaccount.google.com/security
2. Enable 2-Step Verification
3. Search for "App passwords"
4. Generate one for "Mail" and use it as `EMAIL_PASS`

---

## 2. Frontend Setup

```bash
cd pj-music-app/frontend

# Install Capacitor CLI and dependencies
npm install

# Update the API/Socket URL in src/js/config.js:
# Set API_BASE_URL and SOCKET_URL to your backend server address
```

**Update `src/js/config.js` for production:**
```js
API_BASE_URL: 'https://your-backend-server.com/api',
SOCKET_URL: 'https://your-backend-server.com',
```

For local development on a real Android device, use your machine's LAN IP:
```js
API_BASE_URL: 'http://192.168.1.100:5000/api',
SOCKET_URL: 'http://192.168.1.100:5000',
```

---

## 3. Build Android APK

### 3a. Initialize Capacitor (first time only)

```bash
cd pj-music-app/frontend

# Initialize Capacitor
npx cap init "PJ Music" "com.pjmusicapp.app" --web-dir .

# Add Android platform
npx cap add android
```

### 3b. Add Android Permissions

Edit `android/app/src/main/AndroidManifest.xml` to add these permissions inside `<manifest>`:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.VIBRATE" />
```

### 3c. Sync and Open in Android Studio

```bash
# Sync web assets to Android project
npx cap sync android

# Open in Android Studio
npx cap open android
```

### 3d. Build Debug APK in Android Studio

1. Wait for Gradle sync to complete (first time takes a few minutes)
2. Go to **Build → Build Bundle(s)/APK(s) → Build APK(s)**
3. Click "locate" in the notification — APK is at:
   `android/app/build/outputs/apk/debug/app-debug.apk`

### 3e. Install on Device

```bash
# Install directly via ADB (with USB debugging enabled)
adb install android/app/build/outputs/apk/debug/app-debug.apk

# Or enable USB debugging on phone, plug in, and it appears in Android Studio's device picker
```

### 3f. Build Production (Signed) APK

1. In Android Studio: **Build → Generate Signed Bundle/APK**
2. Choose **APK**
3. Create a new keystore (save it somewhere safe!) or use existing
4. Fill in key alias, passwords
5. Select **release** build variant
6. Click **Create** — signed APK appears in `android/app/release/`

**Important:** Never commit your keystore file to version control.

### Re-syncing after frontend changes

Every time you edit frontend files, run:
```bash
cd pj-music-app/frontend
npx cap sync android
```
Then rebuild in Android Studio or use:
```bash
npx cap run android   # live reload on connected device
```

---

## 4. Running Backend in Production

### Using PM2 (recommended)

```bash
npm install -g pm2

cd pj-music-app/backend

# Start with PM2
pm2 start server.js --name pj-music-backend

# Auto-restart on server reboot
pm2 startup
pm2 save

# View logs
pm2 logs pj-music-backend
```

### Using Docker

Create `Dockerfile` in `backend/`:
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 5000
CMD ["node", "server.js"]
```

```bash
docker build -t pj-music-backend .
docker run -d -p 5000:5000 --env-file .env pj-music-backend
```

### Using HTTPS (Required for Production)

Use a reverse proxy like **Nginx** with **Certbot** (Let's Encrypt):

```nginx
server {
    listen 443 ssl;
    server_name your-domain.com;

    ssl_certificate /etc/letsencrypt/live/your-domain.com/fullchain.pem;
    ssl_certificate_key /etc/letsencrypt/live/your-domain.com/privkey.pem;

    location / {
        proxy_pass http://localhost:5000;
        proxy_http_version 1.1;
        proxy_set_header Upgrade $http_upgrade;
        proxy_set_header Connection 'upgrade';
        proxy_set_header Host $host;
        proxy_cache_bypass $http_upgrade;
    }
}
```

Update `ALLOWED_ORIGINS` in `.env` to include your app's origin:
```
ALLOWED_ORIGINS=https://your-domain.com,capacitor://localhost
```

---

## 5. Troubleshooting

### Backend won't connect to MongoDB
- Verify `MONGODB_URI` in `.env`
- For Atlas, ensure your IP is whitelisted
- Check MongoDB is running: `mongod --version`

### Socket.IO won't connect on Android
- Ensure your device is on the same network as the backend (dev)
- Use `http://` (not `localhost`) when on a real device
- Check `ALLOWED_ORIGINS` includes `capacitor://localhost`

### APK can't reach the backend
- HTTPS is required for production (Android blocks plain HTTP by default)
- For dev: enable `allowMixedContent` in `capacitor.config.json` (already set to `false` for security — only enable in dev)
- Or use Android's `network_security_config.xml` to allow cleartext for specific IPs

### File picker not showing audio files
- On Android 13+, `READ_MEDIA_AUDIO` permission is required
- Grant permission when prompted, or go to Settings → Apps → PJ Music → Permissions

### Email password reset not working
- Verify `EMAIL_*` variables in `.env`
- For Gmail, use an App Password (not your regular password)
- Check spam folder

---

## 6. Project Structure

```
pj-music-app/
├── backend/
│   ├── src/
│   │   ├── config/          # Database connection
│   │   ├── controllers/     # Route handlers
│   │   ├── middleware/      # Auth, validation, rate limiting, error handling
│   │   ├── models/          # Mongoose models (User, Song, Playlist, Room)
│   │   ├── routes/          # Express routers
│   │   ├── services/        # Email service
│   │   ├── socket/          # Socket.IO handlers (rooms, peer sync)
│   │   └── utils/           # JWT utils, logger, API response helpers
│   ├── .env.example
│   ├── package.json
│   └── server.js            # Express + Socket.IO entry point
├── frontend/
│   ├── src/
│   │   ├── css/             # Modular stylesheets
│   │   └── js/
│   │       ├── pages/       # Page renderers (home, library, friends, rooms, profile, search)
│   │       ├── api.js       # HTTP client with JWT auth + token refresh
│   │       ├── app.js       # App bootstrap + client-side router
│   │       ├── auth.js      # Login, register, forgot password UI + API calls
│   │       ├── capacitor-init.js  # Native plugin initialization
│   │       ├── config.js    # App configuration
│   │       ├── player.js    # HTML5 audio player with queue, shuffle, repeat
│   │       ├── scanner.js   # File picker + metadata extraction
│   │       ├── socket.js    # Socket.IO client
│   │       ├── storage.js   # Capacitor Preferences (secure storage)
│   │       └── ui.js        # Toast, loading, formatters, XSS protection
│   ├── index.html           # App shell
│   ├── capacitor.config.json
│   └── package.json
├── docs/
│   ├── API.md               # Full REST + WebSocket API reference
│   └── SETUP.md             # This file
└── README.md
```
