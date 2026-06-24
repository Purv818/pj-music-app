/**
 * Secure Storage Abstraction
 * Uses Capacitor Preferences (native encrypted storage on Android).
 * Falls back to localStorage in browser.
 */

const getPrefs = () => window.CapacitorPlugins?.Preferences || {
  get: async ({ key }) => ({ value: localStorage.getItem(key) }),
  set: async ({ key, value }) => { localStorage.setItem(key, value); },
  remove: async ({ key }) => { localStorage.removeItem(key); },
  clear: async () => { localStorage.clear(); },
};

export const storage = {
  async get(key) {
    try {
      const { value } = await getPrefs().get({ key });
      if (value === null || value === undefined) return null;
      try {
        return JSON.parse(value);
      } catch {
        return value; // Return as string if not JSON
      }
    } catch {
      return null;
    }
  },

  async set(key, value) {
    try {
      const serialized = typeof value === 'string' ? value : JSON.stringify(value);
      await getPrefs().set({ key, value: serialized });
    } catch (e) {
      console.error('Storage set error:', e);
    }
  },

  async remove(key) {
    try {
      await getPrefs().remove({ key });
    } catch (e) {
      console.error('Storage remove error:', e);
    }
  },

  async clear() {
    try {
      await getPrefs().clear();
    } catch (e) {
      console.error('Storage clear error:', e);
    }
  },
};

export default storage;
