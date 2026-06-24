/**
 * PJ Music App — Configuration
 *
 * ══════════════════════════════════════════════════════
 *  ⚠️  SIRF YE EK LINE CHANGE KARO (Railway deploy ke baad):
 *
 *  const SERVER_URL = 'https://pj-music-xxxxx.up.railway.app';
 *
 *  Railway URL milti hai: railway.app → apna project → Settings → Domains
 * ══════════════════════════════════════════════════════
 */

// ─── APNA RAILWAY SERVER URL YAHAN DAALO ──────────────────────────────────────
const SERVER_URL = 'https://your-project.up.railway.app';
// ──────────────────────────────────────────────────────────────────────────────

// Auto-detect: local development vs production
const hostname    = window.location.hostname;
const isLocalhost = hostname === 'localhost'
                 || hostname === '127.0.0.1'
                 || /^192\.168\./.test(hostname)
                 || /^10\./.test(hostname)
                 || /^172\.(1[6-9]|2\d|3[01])\./.test(hostname);

export const CONFIG = {
  // Backend API URL
  API_BASE_URL: isLocalhost
    ? `http://${hostname}:5000/api`
    : `${SERVER_URL}/api`,

  // Socket.IO URL (same server)
  SOCKET_URL: isLocalhost
    ? `http://${hostname}:5000`
    : SERVER_URL,

  // Storage keys
  TOKEN_KEY:         'pj_access_token',
  REFRESH_TOKEN_KEY: 'pj_refresh_token',
  USER_KEY:          'pj_user',
  THEME_KEY:         'pj_theme',

  // Pagination
  SONGS_PER_PAGE:   100,
  SEEK_DEBOUNCE_MS: 200,

  // Supported audio formats
  SUPPORTED_AUDIO: [
    'audio/mpeg', 'audio/mp3', 'audio/mp4',
    'audio/aac',  'audio/ogg', 'audio/wav',
    'audio/flac', 'audio/webm', 'audio/x-m4a',
    '.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac', '.opus', '.wma',
  ],
};

export default CONFIG;
