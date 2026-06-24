# PJ Music App — Complete Guide

## Do Log Mobile Data Pe Kaise Connect Honge?

### Problem
Dono users alag jagah hain — alag WiFi ya Mobile Data.
Socket.IO direct connect nahi kar sakta jab tak ek common server na ho.

### Solution — 3 Step

```
User A (Jaipur)          Server (Internet)       User B (Mumbai)
     │                        │                        │
     │──── connect ───────────►│                        │
     │                        │◄──── connect ──────────│
     │                        │                        │
     │──── invite B ──────────►│──── notify B ─────────►│
     │                        │                        │
     │◄─── B accepted ────────│◄──── accept ───────────│
     │                        │                        │
     │──── play song ─────────►│──── sync to B ─────────►│
     │       🎵 both hear same song at same time 🎵      │
```

**Zaroori hai:** Backend server internet pe hona chahiye (not localhost).

---

## Step 1: Backend Server Internet Pe Deploy Karo

### Option A: Railway (FREE, sabse aasan)

1. **https://railway.app** pe jaao → Sign up with GitHub

2. **New Project → Deploy from GitHub repo**

3. Agar GitHub nahi hai, **New Project → Empty Project → Add Service → GitHub Repo**
   Ya directly upload karo

4. **Environment variables** add karo (Settings → Variables):
   ```
   NODE_ENV=production
   PORT=5000
   MONGODB_URI=mongodb+srv://user:pass@cluster.mongodb.net/pjmusic
   JWT_SECRET=<64-char-random-string>
   JWT_REFRESH_SECRET=<another-64-char-string>
   ALLOWED_ORIGINS=https://your-frontend.com,capacitor://localhost
   ```

5. Deploy hone ke baad URL milega jaise:
   `https://pj-music-backend.up.railway.app`

### Option B: Render (FREE tier available)

1. **https://render.com** → New → Web Service
2. Connect GitHub repo
3. Build command: `npm install`
4. Start command: `node server.js`
5. Root directory: `pj-music-app/backend`

### Option C: Local testing (same network only)

```
Dono users ek WiFi pe hon toh:
IP: 192.168.x.x:5000
```

---

## Step 2: MongoDB Atlas (Free Database)

1. **https://cloud.mongodb.com** → Create free cluster
2. Database user banao (username + password)
3. Network Access → `0.0.0.0/0` (sab IPs allow)
4. Connection string copy karo:
   ```
   mongodb+srv://myuser:mypass@cluster0.abc.mongodb.net/pjmusic
   ```
5. Ye string `MONGODB_URI` mein daalo

---

## Step 3: Frontend mein Server URL Update Karo

File: `pj-music-app/frontend/src/js/config.js`

```javascript
// Ye line change karo:
API_BASE_URL: 'https://pj-music-backend.up.railway.app/api',
SOCKET_URL:   'https://pj-music-backend.up.railway.app',
```

---

## Step 4: Android APK Build Karo

### Zaroori Tools Install karo

1. **Node.js** — https://nodejs.org (LTS version)
2. **Android Studio** — https://developer.android.com/studio
   - Install karte waqt: Android SDK ✅, Android Virtual Device ✅
3. **Java JDK 17** — Android Studio ke saath aata hai

### Build Commands

```bash
# 1. Frontend folder mein jaao
cd pj-music-app/frontend

# 2. Dependencies install karo
npm install

# 3. Android platform add karo (sirf pehli baar)
npx cap add android

# 4. AndroidManifest.xml mein permissions add karo
# File: android/app/src/main/AndroidManifest.xml
# <manifest> tag ke andar ye add karo:
```

**`android/app/src/main/AndroidManifest.xml`** mein add karo:

```xml
<uses-permission android:name="android.permission.INTERNET" />
<uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
<uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
<uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
<uses-permission android:name="android.permission.VIBRATE" />
<uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
<uses-permission android:name="android.permission.WAKE_LOCK" />
```

```bash
# 5. Web files Android project mein copy karo
npx cap sync android

# 6. Android Studio mein kholo
npx cap open android
```

### Android Studio mein APK banao

```
1. Android Studio khule
2. Gradle sync hone do (2-5 min)
3. Menu: Build → Build Bundle(s)/APK(s) → Build APK(s)
4. "locate" click karo notification mein
5. APK milegi: android/app/build/outputs/apk/debug/app-debug.apk
```

### Phone pe Install karo

```
1. APK file phone mein transfer karo (USB / WhatsApp / Drive)
2. Phone Settings → Security → Unknown Sources ON karo
   (ya: Settings → Apps → Special app access → Install unknown apps → Files → Allow)
3. APK tap karo → Install
4. Done! 🎉
```

---

## Do Users Kaise Connect Honge — Step by Step

### User A (Host/Room Owner)

```
1. App kholo
2. Friends tab → Add Friend → Share Link ya Code
3. Dost ko apna Invite Code bhejo (WhatsApp/SMS mein)
4. Dost accept kar le
5. Rooms tab → + Create → Room banao
6. Room mein → Invite Friend → Dost select karo
7. Dost join kare → dono connected!
8. Owner jo bhi play/pause/next kare — dosto ke phone pe bhi same hoga
```

### User B (Guest)

```
1. App kholo
2. Friends tab → Add Friend → Enter Code
3. Friend ka 6-digit code type karo → Request bhejo
4. A accept kare
5. Notification aayegi "A ne room mein invite kiya"
6. Accept karo → Connected!
7. A jo baje wahi B pe bhi bajega automatically
```

### Mobile Data pe (Dono alag jagah)

```
✅ Works if: Backend server internet pe deployed hai
✅ Works on: 4G, 5G, any network
✅ Latency: ~100-300ms (negligible for music)

User A (Delhi, Airtel 4G)
  └── HTTPS → Railway Server → Socket.IO → User B (Mumbai, Jio 4G)

Real-time sync:
- Play/pause: <100ms delay
- Seek: <200ms
- Song change: immediate notification
```

---

## Har User ka Alag ID — Kaise Kaam Karta Hai

```
User A downloads app
  └── registerLocalUser() called
      └── generateUserId()     → u_3f8a9b2c4d1e...  (16 random bytes)
      └── generateInviteCode() → KX7M2P              (6 random chars)
      └── Stored in localStorage permanently

User B downloads app (same phone, different account)
  └── registerLocalUser() called
      └── generateUserId()     → u_9a2c1b4f8e3d...  (DIFFERENT!)
      └── generateInviteCode() → R4NP8Q              (DIFFERENT!)

Same person, different device:
  └── ID alag hoga kyunki random generate hota hai
  └── Login email se hota hai — ID wahi rehti hai
```

---

## Features Summary

| Feature | Status | Platform |
|---------|--------|----------|
| Offline songs play | ✅ | Browser + APK |
| Auto next song | ✅ | Both |
| Background play (app band) | ✅ | APK (Media Session) |
| Phone band hone ke baad play | ⚠️ Android only, APK mein | APK |
| Device songs auto-scan | ✅ | APK |
| File picker import | ✅ | Browser + APK |
| Unique user ID | ✅ | Both |
| 6-digit invite code | ✅ | Both |
| Two user sync WiFi | ✅ | Both |
| Two user sync Mobile Data | ✅ (server deploy karo) | Both |
| Lock screen controls | ✅ | Both |

---

## Common Problems & Solutions

### "Songs play nahi ho rahe"
- File format check karo: MP3, AAC, FLAC, OGG support hain
- Import button se dobara import karo
- Browser console mein error dekho (F12)

### "Two users connect nahi ho rahe"
- Backend server internet pe deploy karo
- config.js mein server URL update karo
- Dono users ke phone internet pe hone chahiye

### "Background mein band ho jaata hai"
- Android → Battery Settings → PJ Music → "Don't restrict"
- Ya: Settings → Apps → PJ Music → Battery → Unrestricted

### "APK install nahi ho raha"
- Unknown sources enable karo
- APK corrupt hai toh dobara build karo
