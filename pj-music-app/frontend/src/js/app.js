/**
 * PJ Music App — Main Entry Point
 * Bootstraps the app: checks auth, sets up routing, initializes player and socket.
 */

import CONFIG from './config.js';
import storage from './storage.js';
import { loadAuthState, renderLogin, getUser, setUser } from './auth.js';
import { initPlayerControls } from './player.js';
import { connectSocket } from './socket.js';
import { renderHome, refreshHomeSongs } from './pages/home.js';
import { renderLibrary } from './pages/library.js';
import { renderFriends } from './pages/friends.js';
import { renderRooms } from './pages/rooms.js';
import { renderProfile } from './pages/profile.js';
import { renderSearch } from './pages/search.js';
import { toast } from './ui.js';
import { getStoredUser } from './mock.js';
import { autoScanOnStartup } from './scanner.js';

// ─── App Init ─────────────────────────────────────────────────────────────────

const bootstrap = async () => {
  // Theme restore
  const savedTheme = await storage.get(CONFIG.THEME_KEY);
  if (savedTheme) document.documentElement.dataset.theme = savedTheme;

  // Check karo ki user pehle se logged in hai (localStorage mein stored user)
  const storedUser = getStoredUser();

  if (storedUser) {
    // Auto-login — seedha app open karo
    setUser(storedUser);
    await storage.set(CONFIG.TOKEN_KEY,    'local_token_' + storedUser._id);
    await storage.set(CONFIG.USER_KEY,     storedUser);
    await startApp();
  } else {
    // Pehli baar — login/register screen dikhao
    showAuthScreen();
  }
};

// ─── Auth Screen ──────────────────────────────────────────────────────────────

const showAuthScreen = () => {
  const authScreen = document.getElementById('auth-screen');
  const mainScreen = document.getElementById('main-screen');

  authScreen?.classList.remove('hidden');
  authScreen?.classList.add('active');
  mainScreen?.classList.add('hidden');

  if (authScreen) renderLogin(authScreen);
};

// ─── Start Main App ───────────────────────────────────────────────────────────

const startApp = async () => {
  const authScreen = document.getElementById('auth-screen');
  const mainScreen = document.getElementById('main-screen');

  // Auth screen bilkul nahi dikhni chahiye
  authScreen?.classList.add('hidden');
  authScreen?.classList.remove('active');

  // Main app seedha dikhao
  mainScreen?.classList.remove('hidden');
  mainScreen?.classList.add('active');

  // Background animation shuru karo
  initBackgroundAnimation();

  // Initialize player controls
  initPlayerControls();

  // Connect WebSocket
  await connectSocket();

  // Set up navigation
  initNavigation();

  // Load home by default
  navigateTo('home');

  // ── Auto-scan: device ke songs automatically load karo ──────
  setTimeout(() => {
    autoScanOnStartup((songs) => {
      window._deviceSongs = songs;
      // Home page refresh karo
      refreshHomeSongs();
      // Agar library open hai toh woh bhi refresh karo
      if (currentPage === 'library') navigateTo('library');
    });
  }, 800);
};

// ─── Navigation / Router ─────────────────────────────────────────────────────

let currentPage = '';

const pages = {
  home: renderHome,
  library: renderLibrary,
  friends: renderFriends,
  rooms: renderRooms,
  profile: renderProfile,
};

const pageTitles = {
  home: 'PJ Music',
  library: 'Library',
  friends: 'Friends',
  rooms: 'Rooms',
  profile: 'Profile',
  search: 'Search',
};

const initNavigation = () => {
  // Bottom nav buttons
  document.getElementById('bottom-nav')?.addEventListener('click', (e) => {
    const navItem = e.target.closest('[data-page]');
    if (!navItem) return;
    navigateTo(navItem.dataset.page);
  });

  // Search button in top bar
  document.getElementById('search-btn')?.addEventListener('click', () => {
    navigateTo('search');
  });

  // Theme toggle in top bar
  document.getElementById('theme-toggle')?.addEventListener('click', async () => {
    const isDark = document.documentElement.dataset.theme !== 'light';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = newTheme;
    await storage.set(CONFIG.THEME_KEY, newTheme);
    updateThemeIcon(newTheme);
    try {
      window.CapacitorPlugins?.StatusBar?.setBackgroundColor({
        color: newTheme === 'dark' ? '#0f0f1a' : '#f5f5ff',
      });
    } catch (_) {}
  });
};

const navigateTo = async (page) => {
  if (page === currentPage && page !== 'search') return;
  currentPage = page;

  // Update page title
  const titleEl = document.getElementById('page-title');
  if (titleEl) titleEl.textContent = pageTitles[page] || page;

  // Update nav item active state
  document.querySelectorAll('.nav-item').forEach((item) => {
    item.classList.toggle('active', item.dataset.page === page);
  });

  const container = document.getElementById('page-container');
  if (!container) return;

  // Render page
  if (page === 'search') {
    renderSearch(container);
  } else if (pages[page]) {
    try {
      await pages[page](container);
    } catch (err) {
      console.error(`Error rendering page ${page}:`, err);
      container.innerHTML = `<div class="empty-state"><p class="empty-state__title">Something went wrong</p></div>`;
    }
  }
};

const updateThemeIcon = (theme) => {
  const icon = document.getElementById('theme-icon');
  if (!icon) return;
  if (theme === 'light') {
    icon.innerHTML = `<circle cx="12" cy="12" r="5"/><line x1="12" y1="1" x2="12" y2="3"/>
      <line x1="12" y1="21" x2="12" y2="23"/><line x1="4.22" y1="4.22" x2="5.64" y2="5.64"/>
      <line x1="18.36" y1="18.36" x2="19.78" y2="19.78"/><line x1="1" y1="12" x2="3" y2="12"/>
      <line x1="21" y1="12" x2="23" y2="12"/><line x1="4.22" y1="19.78" x2="5.64" y2="18.36"/>
      <line x1="18.36" y1="5.64" x2="19.78" y2="4.22"/>`;
  } else {
    icon.innerHTML = `<path d="M21 12.79A9 9 0 1 1 11.21 3 7 7 0 0 0 21 12.79z"/>`;
  }
};

// ─── Auth Event Listeners ─────────────────────────────────────────────────────

window.addEventListener('auth:success', () => startApp());

window.addEventListener('auth:logout', () => {
  showAuthScreen();
  import('./socket.js').then(({ disconnectSocket }) => disconnectSocket());
});

// Import ke baad home refresh karo
window.addEventListener('app:songsImported', () => {
  refreshHomeSongs();
});

// ─── Background Animation ─────────────────────────────────────────────────────

const initBackgroundAnimation = () => {
  const mainScreen = document.getElementById('main-screen');
  if (!mainScreen || document.getElementById('bg-canvas')) return;

  // Canvas background
  const canvas = document.createElement('canvas');
  canvas.id = 'bg-canvas';
  canvas.style.cssText = `
    position: fixed;
    top: 0; left: 0;
    width: 100%; height: 100%;
    pointer-events: none;
    z-index: 0;
    opacity: 0.45;
  `;
  mainScreen.prepend(canvas);

  const ctx = canvas.getContext('2d');
  let W = canvas.width  = window.innerWidth;
  let H = canvas.height = window.innerHeight;

  window.addEventListener('resize', () => {
    W = canvas.width  = window.innerWidth;
    H = canvas.height = window.innerHeight;
  });

  // ── Floating orbs ───────────────────────────────────────────
  const ORBS = Array.from({ length: 6 }, (_, i) => ({
    x:     Math.random() * W,
    y:     Math.random() * H,
    r:     80 + Math.random() * 120,
    dx:    (Math.random() - 0.5) * 0.4,
    dy:    (Math.random() - 0.5) * 0.4,
    hue:   [260, 280, 200, 320, 230, 270][i],
    alpha: 0.12 + Math.random() * 0.1,
  }));

  // ── Music notes ──────────────────────────────────────────────
  const NOTES = ['♩', '♪', '♫', '♬', '🎵', '🎶'];
  const particles = Array.from({ length: 18 }, () => createParticle(W, H));

  function createParticle(w, h, fromBottom = false) {
    return {
      x:     Math.random() * w,
      y:     fromBottom ? h + 20 : Math.random() * h,
      char:  NOTES[Math.floor(Math.random() * NOTES.length)],
      size:  10 + Math.random() * 14,
      alpha: 0.05 + Math.random() * 0.18,
      speed: 0.25 + Math.random() * 0.5,
      drift: (Math.random() - 0.5) * 0.4,
      spin:  (Math.random() - 0.5) * 0.02,
      angle: 0,
    };
  }

  // ── Waveform bars (bottom strip) ─────────────────────────────
  const BAR_COUNT = 28;
  const barHeights = Array.from({ length: BAR_COUNT }, () => ({
    h:      10 + Math.random() * 30,
    target: 10 + Math.random() * 40,
    speed:  0.04 + Math.random() * 0.06,
  }));

  let frame = 0;

  const draw = () => {
    ctx.clearRect(0, 0, W, H);

    // ── Orbs ──────────────────────────────────────────────────
    ORBS.forEach(orb => {
      orb.x += orb.dx;
      orb.y += orb.dy;
      if (orb.x < -orb.r) orb.x = W + orb.r;
      if (orb.x > W + orb.r) orb.x = -orb.r;
      if (orb.y < -orb.r) orb.y = H + orb.r;
      if (orb.y > H + orb.r) orb.y = -orb.r;

      const grad = ctx.createRadialGradient(orb.x, orb.y, 0, orb.x, orb.y, orb.r);
      grad.addColorStop(0,   `hsla(${orb.hue}, 80%, 65%, ${orb.alpha})`);
      grad.addColorStop(0.5, `hsla(${orb.hue}, 70%, 50%, ${orb.alpha * 0.5})`);
      grad.addColorStop(1,   `hsla(${orb.hue}, 60%, 40%, 0)`);
      ctx.beginPath();
      ctx.arc(orb.x, orb.y, orb.r, 0, Math.PI * 2);
      ctx.fillStyle = grad;
      ctx.fill();
    });

    // ── Music note particles ──────────────────────────────────
    particles.forEach((p, i) => {
      p.y     -= p.speed;
      p.x     += p.drift;
      p.angle += p.spin;
      p.alpha  = Math.max(0, p.alpha - 0.0003);

      if (p.y < -30 || p.alpha <= 0) {
        particles[i] = createParticle(W, H, true);
        return;
      }

      ctx.save();
      ctx.globalAlpha = p.alpha;
      ctx.font        = `${p.size}px serif`;
      ctx.fillStyle   = `hsl(${260 + Math.sin(frame * 0.01 + i) * 60}, 80%, 75%)`;
      ctx.translate(p.x, p.y);
      ctx.rotate(p.angle);
      ctx.fillText(p.char, 0, 0);
      ctx.restore();
    });

    // ── Waveform strip (neeche) ───────────────────────────────
    const barW   = W / BAR_COUNT;
    const baseY  = H - 6;
    const isPlay = !document.getElementById('audio-element')?.paused;

    barHeights.forEach((bar, i) => {
      if (isPlay) {
        bar.target = 8 + Math.random() * 38;
      } else {
        bar.target = 6 + Math.sin(frame * 0.03 + i * 0.5) * 10;
      }
      bar.h += (bar.target - bar.h) * bar.speed;

      const hue = 250 + (i / BAR_COUNT) * 80;
      ctx.beginPath();
      ctx.roundRect(
        i * barW + 1, baseY - bar.h,
        barW - 2,     bar.h,
        2
      );
      ctx.fillStyle = `hsla(${hue}, 75%, 65%, 0.35)`;
      ctx.fill();
    });

    frame++;
    requestAnimationFrame(draw);
  };

  draw();
};

// ─── Start ────────────────────────────────────────────────────────────────────

document.addEventListener('DOMContentLoaded', () => {
  setTimeout(bootstrap, 100);
});
