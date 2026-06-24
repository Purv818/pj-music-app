/**
 * Profile Page
 * User info, stats, settings (theme, password change), logout.
 */

import api from '../api.js';
import { getUser, logout } from '../auth.js';
import { escapeHTML, toast } from '../ui.js';
import CONFIG from '../config.js';
import storage from '../storage.js';
import { updateLocalUser } from '../mock.js';

// ─── Invite Code (user ke unique code se) ───────────────────────────────────
const generateProfileCode = (userId) => {
  // ab mock.js mein user ke paas already inviteCode field hai
  return userId; // direct use karenge
};

export const renderProfile = async (container) => {
  const user = getUser();
  // User ka actual unique invite code use karo
  const inviteCode = user?.inviteCode || '------';

  container.innerHTML = `
    <div class="page page-enter" id="profile-page">
      <!-- Hero -->
      <div class="profile-hero">
        <div class="avatar avatar-xl">
          ${user?.avatar
            ? `<img src="${escapeHTML(user.avatar)}" alt="Profile photo" />`
            : `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
                <circle cx="12" cy="7" r="4"/>
               </svg>`
          }
        </div>
        <div>
          <h2 class="profile-hero__name">${escapeHTML(user?.displayName || user?.username || 'User')}</h2>
          <p class="profile-hero__username">@${escapeHTML(user?.username || '')}</p>
          ${user?.bio ? `<p class="profile-hero__bio">${escapeHTML(user.bio)}</p>` : ''}
        </div>
      </div>

      <!-- Stats -->
      <div class="profile-stats">
        <div class="profile-stat">
          <span class="profile-stat__value" id="stat-songs">—</span>
          <span class="profile-stat__label">Songs</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat__value" id="stat-playlists">—</span>
          <span class="profile-stat__label">Playlists</span>
        </div>
        <div class="profile-stat">
          <span class="profile-stat__value" id="stat-friends">—</span>
          <span class="profile-stat__label">Friends</span>
        </div>
      </div>

      <div class="divider"></div>

      <!-- Settings -->
      <div class="card card-padded section">
        <!-- Theme toggle -->
        <div class="settings-row" id="theme-row">
          <span class="settings-row__label">Dark Mode</span>
          <div class="settings-row__value">
            <div class="toggle ${document.documentElement.dataset.theme === 'dark' ? 'on' : ''}" id="theme-toggle-switch"></div>
          </div>
        </div>

        <!-- My Invite Code -->
        <div class="settings-row" id="invite-code-row" style="cursor:default;">
          <div>
            <span class="settings-row__label">My Invite Code</span>
            <div style="font-size:1.1rem;font-weight:700;letter-spacing:3px;color:var(--color-primary);margin-top:2px;" id="my-invite-code">
              ${inviteCode}
            </div>
          </div>
          <button class="btn btn-sm btn-secondary" id="copy-code-btn" style="flex-shrink:0;">Copy</button>
        </div>

        <!-- Edit profile -->
        <div class="settings-row" id="edit-profile-row">
          <span class="settings-row__label">Edit Profile</span>
          <div class="settings-row__value">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>

        <!-- Change password -->
        <div class="settings-row" id="change-password-row">
          <span class="settings-row__label">Change Password</span>
          <div class="settings-row__value">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
              <polyline points="9 18 15 12 9 6"/>
            </svg>
          </div>
        </div>
      </div>

      <!-- Logout -->
      <button class="btn btn-danger btn-full" id="logout-btn" style="margin-top:8px;">Sign Out</button>
    </div>`;

  // Load stats
  loadStats();

  // Copy invite code
  document.getElementById('copy-code-btn')?.addEventListener('click', async () => {
    const code = document.getElementById('my-invite-code')?.textContent?.trim();
    try {
      await navigator.clipboard.writeText(code || '');
      toast('Code copy ho gaya! Dosto ko bhejo 🎉', 'success');
    } catch { toast(code || '', 'info', 5000); }
  });

  // Theme toggle
  document.getElementById('theme-toggle-switch')?.addEventListener('click', () => {
    const isDark = document.documentElement.dataset.theme === 'dark';
    const newTheme = isDark ? 'light' : 'dark';
    document.documentElement.dataset.theme = newTheme;
    storage.set(CONFIG.THEME_KEY, newTheme);
    document.getElementById('theme-toggle-switch')?.classList.toggle('on', !isDark);
    // Update status bar color
    try {
      const color = newTheme === 'dark' ? '#0f0f1a' : '#f5f5ff';
      window.CapacitorPlugins?.StatusBar?.setBackgroundColor({ color });
    } catch (_) {}
  });

  // Edit profile
  document.getElementById('edit-profile-row')?.addEventListener('click', showEditProfileModal);

  // Change password
  document.getElementById('change-password-row')?.addEventListener('click', showChangePasswordModal);

  // Logout
  document.getElementById('logout-btn')?.addEventListener('click', async () => {
    if (!confirm('Sign out of PJ Music?')) return;
    await logout();
    window.dispatchEvent(new CustomEvent('auth:logout'));
  });
};

const loadStats = async () => {
  try {
    const [songsRes, playlistsRes, friendsRes] = await Promise.allSettled([
      api.get('/songs?limit=1'),
      api.get('/playlists'),
      api.get('/friends'),
    ]);

    if (songsRes.status === 'fulfilled') {
      document.getElementById('stat-songs').textContent = songsRes.value.data?.total || 0;
    }
    if (playlistsRes.status === 'fulfilled') {
      document.getElementById('stat-playlists').textContent = playlistsRes.value.data?.length || 0;
    }
    if (friendsRes.status === 'fulfilled') {
      document.getElementById('stat-friends').textContent = friendsRes.value.data?.length || 0;
    }
  } catch (_) {}
};

const showEditProfileModal = () => {
  const user = getUser();
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h2 style="margin-bottom:16px;">Edit Profile</h2>
      <div class="auth-form" id="edit-profile-form">
        <div class="form-group">
          <label class="form-label">Display Name</label>
          <input class="form-input" type="text" id="edit-displayname" value="${escapeHTML(user?.displayName || '')}" maxlength="50" />
        </div>
        <div class="form-group">
          <label class="form-label">Bio</label>
          <input class="form-input" type="text" id="edit-bio" value="${escapeHTML(user?.bio || '')}" maxlength="200" placeholder="Tell people about yourself" />
        </div>
        <button class="btn btn-primary btn-full" id="save-profile-btn">Save Changes</button>
        <button class="btn btn-secondary btn-full" id="cancel-edit-btn">Cancel</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cancel-edit-btn')?.addEventListener('click', () => overlay.remove());

  document.getElementById('save-profile-btn')?.addEventListener('click', async () => {
    const displayName = document.getElementById('edit-displayname')?.value.trim();
    const bio = document.getElementById('edit-bio')?.value.trim();

    try {
      const res = await api.patch('/users/me', { displayName, bio });
      // Update local state
      const updatedUser = res.data;
      await storage.set(CONFIG.USER_KEY, updatedUser);
      toast('Profile updated!', 'success');
      overlay.remove();
      // Re-render profile
      const container = document.getElementById('page-container');
      if (container) renderProfile(container);
    } catch (err) {
      toast(err.message || 'Could not update profile', 'error');
    }
  });
};

const showChangePasswordModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h2 style="margin-bottom:16px;">Change Password</h2>
      <div class="auth-form">
        <div class="form-group">
          <label class="form-label">Current Password</label>
          <input class="form-input" type="password" id="cur-password" autocomplete="current-password" />
        </div>
        <div class="form-group">
          <label class="form-label">New Password</label>
          <input class="form-input" type="password" id="new-password" autocomplete="new-password" placeholder="Min 8 chars, 1 uppercase, 1 number" />
        </div>
        <div id="pw-change-error" class="form-error" style="display:none;"></div>
        <button class="btn btn-primary btn-full" id="save-password-btn">Update Password</button>
        <button class="btn btn-secondary btn-full" id="cancel-pw-btn">Cancel</button>
      </div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cancel-pw-btn')?.addEventListener('click', () => overlay.remove());

  document.getElementById('save-password-btn')?.addEventListener('click', async () => {
    const currentPassword = document.getElementById('cur-password')?.value;
    const newPassword = document.getElementById('new-password')?.value;
    const errEl = document.getElementById('pw-change-error');

    if (!currentPassword || !newPassword) {
      errEl.textContent = 'Both fields are required.';
      errEl.style.display = 'block';
      return;
    }

    try {
      await api.patch('/users/me/password', { currentPassword, newPassword });
      toast('Password updated! Please log in again.', 'success');
      overlay.remove();
      await logout();
      window.dispatchEvent(new CustomEvent('auth:logout'));
    } catch (err) {
      errEl.textContent = err.message || 'Could not update password';
      errEl.style.display = 'block';
    }
  });
};
