/**
 * Capacitor Plugin Initialization
 * Loads native plugins (StatusBar, Haptics, Preferences).
 * Falls back gracefully when running in a browser.
 */

// These imports work when the Capacitor runtime is present (on Android).
// In browser dev mode they resolve to web shims.
let StatusBar, Haptics, Preferences;

try {
  ({ StatusBar } = await import('@capacitor/status-bar'));
  ({ Haptics } = await import('@capacitor/haptics'));
  ({ Preferences } = await import('@capacitor/preferences'));
} catch (e) {
  // Running in browser without Capacitor — provide no-op shims
  StatusBar = {
    setStyle: async () => {},
    setBackgroundColor: async () => {},
  };
  Haptics = {
    impact: async () => {},
    vibrate: async () => {},
  };
  Preferences = {
    get: async ({ key }) => ({ value: localStorage.getItem(key) }),
    set: async ({ key, value }) => { localStorage.setItem(key, value); },
    remove: async ({ key }) => { localStorage.removeItem(key); },
    clear: async () => { localStorage.clear(); },
  };
}

// Export for use across the app
window.CapacitorPlugins = { StatusBar, Haptics, Preferences };

// Set status bar style to match dark theme
try {
  await StatusBar.setStyle({ style: 'dark' });
  await StatusBar.setBackgroundColor({ color: '#0f0f1a' });
} catch (_) {}
