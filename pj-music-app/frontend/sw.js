/**
 * PJ Music — Service Worker
 * App shell cache karta hai taaki offline bhi kaam kare.
 */

const CACHE_NAME  = 'pj-music-v3';

const SHELL_ASSETS = [
  '/',
  '/index.html',
  '/manifest.json',
  '/icons/icon.svg',
  '/src/css/variables.css',
  '/src/css/reset.css',
  '/src/css/components.css',
  '/src/css/layout.css',
  '/src/css/player.css',
  '/src/css/pages.css',
  '/src/css/animations.css',
  '/src/js/app.js',
  '/src/js/api.js',
  '/src/js/auth.js',
  '/src/js/player.js',
  '/src/js/audio-engine.js',
  '/src/js/scanner.js',
  '/src/js/socket.js',
  '/src/js/storage.js',
  '/src/js/ui.js',
  '/src/js/config.js',
  '/src/js/mock.js',
  '/src/js/capacitor-init.js',
  '/src/js/pages/home.js',
  '/src/js/pages/library.js',
  '/src/js/pages/friends.js',
  '/src/js/pages/rooms.js',
  '/src/js/pages/profile.js',
  '/src/js/pages/search.js',
];

// ─── Install ──────────────────────────────────────────────────────────────────
self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then(cache =>
      cache.addAll(SHELL_ASSETS).catch(err =>
        console.warn('[SW] Cache partial fail:', err)
      )
    )
  );
  self.skipWaiting();
});

// ─── Activate ─────────────────────────────────────────────────────────────────
self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ─── Fetch ────────────────────────────────────────────────────────────────────
self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // External requests — bypass (fonts, CDN, API)
  if (url.hostname !== self.location.hostname) return;
  if (url.pathname.startsWith('/api')) return;

  // blob: URLs — bypass (local audio files)
  if (e.request.url.startsWith('blob:')) return;

  // App shell — cache first, network fallback
  e.respondWith(
    caches.match(e.request).then(cached => {
      if (cached) return cached;

      return fetch(e.request).then(res => {
        if (res.ok && e.request.method === 'GET') {
          const clone = res.clone();
          caches.open(CACHE_NAME).then(c => c.put(e.request, clone));
        }
        return res;
      });
    }).catch(() => {
      if (e.request.mode === 'navigate') {
        return caches.match('/index.html');
      }
    })
  );
});
