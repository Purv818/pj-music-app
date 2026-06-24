/**
 * UI Utility Functions
 * Toast notifications, loading overlay, formatting helpers.
 */

// ─── Toast ────────────────────────────────────────────────────────────────────

const toastContainer = () => document.getElementById('toast-container');

/**
 * Show a toast notification.
 * @param {string} message
 * @param {'success'|'error'|'info'} type
 * @param {number} duration - milliseconds
 */
export const toast = (message, type = 'info', duration = 3000) => {
  const container = toastContainer();
  if (!container) return;

  const el = document.createElement('div');
  el.className = `toast ${type}`;
  el.textContent = message;
  container.appendChild(el);

  // Haptic feedback on mobile
  try {
    window.CapacitorPlugins?.Haptics?.impact({ style: type === 'error' ? 'heavy' : 'light' });
  } catch (_) {}

  setTimeout(() => {
    el.style.animation = 'toast-out 0.25s ease forwards';
    el.addEventListener('animationend', () => el.remove(), { once: true });
  }, duration);
};

// ─── Loading Overlay ──────────────────────────────────────────────────────────

export const showLoading = () => {
  document.getElementById('loading-overlay')?.classList.remove('hidden');
};

export const hideLoading = () => {
  document.getElementById('loading-overlay')?.classList.add('hidden');
};

// ─── Format Helpers ───────────────────────────────────────────────────────────

/**
 * Format seconds to m:ss string.
 * @param {number} seconds
 * @returns {string}
 */
export const formatTime = (seconds) => {
  if (!seconds || isNaN(seconds)) return '0:00';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
};

/**
 * Format bytes to human-readable string.
 * @param {number} bytes
 * @returns {string}
 */
export const formatBytes = (bytes) => {
  if (!bytes) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return `${parseFloat((bytes / Math.pow(k, i)).toFixed(1))} ${sizes[i]}`;
};

/**
 * Render a song's artwork — returns an img element or placeholder div.
 * @param {string|null} artworkData - base64 or URL
 * @param {string} alt
 * @returns {string} HTML string
 */
export const artworkHTML = (artworkData, alt = 'Album art') => {
  if (artworkData) {
    const src = artworkData.startsWith('data:') ? artworkData : `data:image/jpeg;base64,${artworkData}`;
    return `<img src="${escapeHTML(src)}" alt="${escapeHTML(alt)}" loading="lazy" />`;
  }
  return `
    <svg viewBox="0 0 24 24" fill="currentColor" aria-hidden="true">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>`;
};

/**
 * Escape HTML special characters to prevent XSS.
 * @param {string} str
 * @returns {string}
 */
export const escapeHTML = (str) => {
  if (typeof str !== 'string') return '';
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#039;');
};

/**
 * Debounce a function.
 * @param {Function} fn
 * @param {number} delay
 * @returns {Function}
 */
export const debounce = (fn, delay) => {
  let timer;
  return (...args) => {
    clearTimeout(timer);
    timer = setTimeout(() => fn(...args), delay);
  };
};

/**
 * Create an equalizer animation element (for now-playing indicators).
 * @returns {string} HTML string
 */
export const eqBarsHTML = () => `
  <div class="eq-bars" aria-hidden="true">
    <div class="eq-bar"></div>
    <div class="eq-bar"></div>
    <div class="eq-bar"></div>
    <div class="eq-bar"></div>
  </div>`;

/**
 * Relative time string (e.g. "2 min ago").
 * @param {string|Date} date
 * @returns {string}
 */
export const relativeTime = (date) => {
  const now = Date.now();
  const diff = now - new Date(date).getTime();
  if (diff < 60000) return 'Just now';
  if (diff < 3600000) return `${Math.floor(diff / 60000)}m ago`;
  if (diff < 86400000) return `${Math.floor(diff / 3600000)}h ago`;
  return `${Math.floor(diff / 86400000)}d ago`;
};
