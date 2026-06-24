/**
 * PJ Music — Local Auth & Mock Data
 *
 * Har user ka ALAG ID hota hai — device pe securely store hota hai.
 * Login sirf ek baar — phir auto-login.
 * Friends system ke liye unique 6-char invite code — har user ka alag.
 */

import storage from './storage.js';

// ─── User ID Generator ────────────────────────────────────────────────────────

/**
 * Cryptographically random unique user ID banao.
 * Ye ek baar banta hai aur permanently store hota hai.
 */
const generateUserId = () => {
  const arr = new Uint8Array(16);
  crypto.getRandomValues(arr);
  return 'u_' + Array.from(arr, b => b.toString(16).padStart(2, '0')).join('');
};

/**
 * Unique 6-char friend invite code banao.
 * Har user ka alag code hota hai.
 */
const generateInviteCode = () => {
  const chars = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  let code = '';
  const arr = new Uint8Array(6);
  crypto.getRandomValues(arr);
  arr.forEach(b => { code += chars[b % chars.length]; });
  return code;
};

// ─── User Management ──────────────────────────────────────────────────────────

const USER_KEY   = 'pj_local_user';
const USERS_KEY  = 'pj_all_users';   // registered users list (local)

/**
 * Stored users list lo (registered users on this device).
 */
const getStoredUsers = () => {
  try {
    return JSON.parse(localStorage.getItem(USERS_KEY) || '[]');
  } catch { return []; }
};

const saveStoredUsers = (users) => {
  localStorage.setItem(USERS_KEY, JSON.stringify(users));
};

/**
 * Naya user register karo — unique ID + invite code milega.
 */
export const registerLocalUser = (displayName, email, password) => {
  const users = getStoredUsers();

  // Email already registered?
  const existing = users.find(u => u.email.toLowerCase() === email.toLowerCase());
  if (existing) {
    throw new Error('Ye email pehle se registered hai. Login karo.');
  }

  // Simple password hash (real app mein bcrypt server-side hoti hai)
  const pwHash = btoa(password + '_pj_salt_v1');

  const newUser = {
    _id:        generateUserId(),    // ← UNIQUE har user ke liye
    inviteCode: generateInviteCode(), // ← UNIQUE har user ke liye
    displayName: displayName.trim(),
    username:   email.split('@')[0].toLowerCase().replace(/[^a-z0-9_]/g, '_'),
    email:      email.trim().toLowerCase(),
    pwHash,
    bio:        '',
    avatar:     null,
    theme:      'dark',
    friends:    [],
    favorites:  [],
    createdAt:  new Date().toISOString(),
  };

  users.push(newUser);
  saveStoredUsers(users);

  // Current user set karo
  const safeUser = { ...newUser };
  delete safeUser.pwHash;
  localStorage.setItem(USER_KEY, JSON.stringify(safeUser));

  return safeUser;
};

/**
 * Login karo.
 */
export const loginLocalUser = (email, password) => {
  const users  = getStoredUsers();
  const user   = users.find(u => u.email.toLowerCase() === email.toLowerCase());

  if (!user) throw new Error('Email registered nahi hai. Pehle Sign Up karo.');

  const pwHash = btoa(password + '_pj_salt_v1');
  if (user.pwHash !== pwHash) throw new Error('Password galat hai.');

  const safeUser = { ...user };
  delete safeUser.pwHash;
  localStorage.setItem(USER_KEY, JSON.stringify(safeUser));

  return safeUser;
};

/**
 * Stored logged-in user lo.
 */
export const getStoredUser = () => {
  try {
    const str = localStorage.getItem(USER_KEY);
    return str ? JSON.parse(str) : null;
  } catch { return null; }
};

/**
 * Logout.
 */
export const logoutLocalUser = () => {
  localStorage.removeItem(USER_KEY);
};

/**
 * Profile update karo.
 */
export const updateLocalUser = (updates) => {
  const current = getStoredUser();
  if (!current) return null;

  const updated = { ...current, ...updates };
  localStorage.setItem(USER_KEY, JSON.stringify(updated));

  // Users list mein bhi update karo
  const users = getStoredUsers();
  const idx   = users.findIndex(u => u._id === current._id);
  if (idx >= 0) {
    users[idx] = { ...users[idx], ...updates };
    saveStoredUsers(users);
  }

  return updated;
};

// ─── Mock Songs ───────────────────────────────────────────────────────────────
// Sirf UI preview ke liye — actual songs user ke device se aate hain
export const MOCK_SONGS = [];  // Empty — device songs library mein dikhenge

export const MOCK_PLAYLISTS = [
  { _id: 'pl_1', name: 'My Favorites ❤️',    description: '', songCount: 0, isPublic: false, artwork: null },
  { _id: 'pl_2', name: 'Recently Added 🆕',  description: '', songCount: 0, isPublic: false, artwork: null },
];

export const MOCK_FRIENDS  = [];
export const MOCK_REQUESTS = { received: [], sent: [] };
export const MOCK_ROOMS    = [];

// ─── Mock API ─────────────────────────────────────────────────────────────────
const delay = (ms = 200) => new Promise(r => setTimeout(r, ms));
const ok    = (data, msg = 'OK') => ({ success: true, message: msg, data });
const err   = (msg, code = 400) => { const e = new Error(msg); e.status = code; throw e; };

export const mockApi = {
  async get(endpoint) {
    await delay(80);
    const user = getStoredUser();

    if (endpoint.startsWith('/songs/search')) {
      const q = new URL('http://x' + endpoint).searchParams.get('q') || '';
      const deviceSongs = window._deviceSongs || [];
      const results = deviceSongs.filter(s =>
        s.title?.toLowerCase().includes(q.toLowerCase()) ||
        s.artist?.toLowerCase().includes(q.toLowerCase()) ||
        s.album?.toLowerCase().includes(q.toLowerCase())
      );
      return ok(results);
    }

    if (endpoint === '/songs/favorites') {
      const favIds  = user?.favorites || [];
      const all     = window._deviceSongs || [];
      return ok(all.filter(s => favIds.includes(String(s._id))));
    }

    if (endpoint.startsWith('/songs')) {
      const params = new URL('http://x' + endpoint).searchParams;
      const sortBy = params.get('sortBy') || 'title';
      const order  = params.get('order')  || 'asc';
      const limit  = parseInt(params.get('limit')) || 500;

      let songs = [...(window._deviceSongs || [])];

      songs.sort((a, b) => {
        const va = String(a[sortBy] ?? '');
        const vb = String(b[sortBy] ?? '');
        return order === 'desc' ? vb.localeCompare(va) : va.localeCompare(vb);
      });

      songs = songs.slice(0, limit);
      return ok({ songs, total: songs.length, page: 1, pages: 1 });
    }

    if (endpoint === '/playlists')          return ok(MOCK_PLAYLISTS);
    if (endpoint.startsWith('/playlists/')) return ok({ ...MOCK_PLAYLISTS[0], songs: [] });

    if (endpoint === '/friends')            return ok(user?.friends || []);
    if (endpoint === '/friends/requests')   return ok(MOCK_REQUESTS);

    if (endpoint === '/rooms')              return ok(MOCK_ROOMS);
    if (endpoint.startsWith('/rooms/'))     return ok(null);

    if (endpoint.startsWith('/users/search')) {
      const q = new URL('http://x' + endpoint).searchParams.get('q') || '';
      const allUsers = getStoredUsers()
        .filter(u => u._id !== user?._id)
        .filter(u =>
          u.displayName?.toLowerCase().includes(q.toLowerCase()) ||
          u.username?.toLowerCase().includes(q.toLowerCase()) ||
          u.email?.toLowerCase().includes(q.toLowerCase())
        )
        .map(({ pwHash, ...safe }) => safe);
      return ok(allUsers);
    }

    if (endpoint === '/auth/me') return ok(user);

    return ok([]);
  },

  async post(endpoint, body) {
    await delay(150);
    const user = getStoredUser();

    if (endpoint === '/auth/register') {
      const { displayName, email, password } = body || {};
      if (!displayName || !email || !password) err('Sab fields bharo');
      if (password.length < 6) err('Password kam se kam 6 characters ka hona chahiye');
      const newUser = registerLocalUser(displayName, email, password);
      return ok({ accessToken: 'local_token_' + newUser._id, refreshToken: 'local_refresh', user: newUser });
    }

    if (endpoint === '/auth/login') {
      const { email, password } = body || {};
      if (!email || !password) err('Email aur password dono bharo');
      const loggedIn = loginLocalUser(email, password);
      return ok({ accessToken: 'local_token_' + loggedIn._id, refreshToken: 'local_refresh', user: loggedIn });
    }

    if (endpoint === '/auth/logout') {
      logoutLocalUser();
      return ok(null, 'Logout successful');
    }

    if (endpoint === '/auth/forgot-password') return ok(null, 'Demo mode mein email nahi jaata. Password yaad karo 😄');

    if (endpoint === '/playlists') {
      const pl = { _id: 'pl_' + Date.now(), name: body?.name || 'New Playlist', songCount: 0, isPublic: false, artwork: null };
      MOCK_PLAYLISTS.push(pl);
      return ok(pl);
    }

    if (endpoint.includes('/favorite')) {
      const songId  = endpoint.split('/')[2];
      const favs    = user?.favorites || [];
      const isFav   = favs.includes(String(songId));
      const newFavs = isFav ? favs.filter(id => id !== String(songId)) : [...favs, String(songId)];
      updateLocalUser({ favorites: newFavs });
      return ok({ isFavorite: !isFav });
    }

    if (endpoint.includes('/play')) return ok({ playCount: 1 });

    if (endpoint === '/rooms') {
      const room = { _id: 'room_' + Date.now(), name: body?.name, owner: user, members: [{ user }], status: 'active', maxMembers: body?.maxMembers || 10 };
      MOCK_ROOMS.push(room);
      return ok(room);
    }

    if (endpoint.includes('/friends/request')) {
      return ok(null, 'Friend request bhej di!');
    }

    if (endpoint.includes('/friends/accept')) {
      return ok(null, 'Friend add ho gaya!');
    }

    if (endpoint.includes('/friends/reject'))  return ok(null, 'Reject kar diya');
    if (endpoint.includes('/invite'))          return ok({ invitationToken: 'demo' });
    if (endpoint === '/rooms/join')            return ok({ roomId: 'room_1' });
    if (endpoint.includes('/leave'))           return ok(null, 'Left room');
    if (endpoint === '/songs/sync')            return ok({ upserted: body?.songs?.length || 0 });

    return ok(null, 'OK');
  },

  async patch(endpoint, body) {
    await delay(150);
    if (endpoint === '/users/me') {
      const updated = updateLocalUser(body);
      return ok(updated);
    }
    if (endpoint === '/users/me/password') return ok(null, 'Password updated');
    return ok(null, 'Updated');
  },

  async put(endpoint, body)  { await delay(100); return ok(null, 'Updated'); },
  async delete(endpoint)     { await delay(100); return ok(null, 'Deleted'); },
};
