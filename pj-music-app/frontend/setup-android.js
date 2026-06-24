/**
 * PJ Music — Android Setup Script
 * Run: node setup-android.js
 * 
 * Ye script automatically AndroidManifest.xml mein
 * permissions add karta hai.
 */

const fs   = require('fs');
const path = require('path');

const MANIFEST_PATH = path.join(
  __dirname, 'android', 'app', 'src', 'main', 'AndroidManifest.xml'
);

const PERMISSIONS = `
    <!-- PJ Music Permissions -->
    <uses-permission android:name="android.permission.INTERNET" />
    <uses-permission android:name="android.permission.ACCESS_NETWORK_STATE" />
    <uses-permission android:name="android.permission.READ_EXTERNAL_STORAGE" android:maxSdkVersion="32" />
    <uses-permission android:name="android.permission.READ_MEDIA_AUDIO" />
    <uses-permission android:name="android.permission.VIBRATE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE" />
    <uses-permission android:name="android.permission.FOREGROUND_SERVICE_MEDIA_PLAYBACK" />
    <uses-permission android:name="android.permission.WAKE_LOCK" />
`;

if (!fs.existsSync(MANIFEST_PATH)) {
  console.log('❌ AndroidManifest.xml nahi mila.');
  console.log('   Pehle ye command chalao: npx cap add android');
  process.exit(1);
}

let content = fs.readFileSync(MANIFEST_PATH, 'utf8');

if (content.includes('PJ Music Permissions')) {
  console.log('✅ Permissions pehle se add hain.');
  process.exit(0);
}

// <manifest> ke baad insert karo
content = content.replace(
  /(<manifest[^>]*>)/,
  `$1\n${PERMISSIONS}`
);

fs.writeFileSync(MANIFEST_PATH, content, 'utf8');
console.log('✅ AndroidManifest.xml mein permissions add ho gayi!');
console.log('   Ab Android Studio mein APK build karo.');
