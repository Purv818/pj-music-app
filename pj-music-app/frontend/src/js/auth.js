/**
 * PJ Music — Auth Module
 * Local auth using localStorage — har user ka unique ID + invite code.
 */

import api from './api.js';
import storage from './storage.js';
import CONFIG from './config.js';
import { toast } from './ui.js';
import { loginLocalUser, registerLocalUser, logoutLocalUser, getStoredUser } from './mock.js';

// ─── State ────────────────────────────────────────────────────────────────────

let currentUser = null;

export const getUser = () => currentUser;
export const setUser = (u) => { currentUser = u; };

// ─── Auth State ───────────────────────────────────────────────────────────────

export const loadAuthState = async () => {
  const user = getStoredUser();
  if (user) {
    currentUser = user;
    return true;
  }
  return false;
};

const persistAuth = async (accessToken, refreshToken, user) => {
  await storage.set(CONFIG.TOKEN_KEY,         accessToken);
  await storage.set(CONFIG.REFRESH_TOKEN_KEY, refreshToken);
  await storage.set(CONFIG.USER_KEY,          user);
  currentUser = user;
};

export const clearAuth = async () => {
  logoutLocalUser();
  await storage.remove(CONFIG.TOKEN_KEY);
  await storage.remove(CONFIG.REFRESH_TOKEN_KEY);
  await storage.remove(CONFIG.USER_KEY);
  currentUser = null;
};

// ─── API wrappers ─────────────────────────────────────────────────────────────

export const login = async (email, password) => {
  const data = await api.post('/auth/login', { email, password });
  await persistAuth(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user;
};

export const register = async (displayName, email, password) => {
  const data = await api.post('/auth/register', { displayName, email, password });
  await persistAuth(data.data.accessToken, data.data.refreshToken, data.data.user);
  return data.data.user;
};

export const logout = async () => {
  try { await api.post('/auth/logout', {}); } catch (_) {}
  await clearAuth();
};

export const forgotPassword = async (email) =>
  api.post('/auth/forgot-password', { email });

// ─── UI ───────────────────────────────────────────────────────────────────────

const logoHTML = `
  <div class="auth-logo">
    <svg viewBox="0 0 24 24" fill="currentColor">
      <path d="M12 3v10.55c-.59-.34-1.27-.55-2-.55-2.21 0-4 1.79-4 4s1.79 4 4 4 4-1.79 4-4V7h4V3h-6z"/>
    </svg>
  </div>`;

// ─── Login Page ───────────────────────────────────────────────────────────────

export const renderLogin = (container) => {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-header">
        ${logoHTML}
        <h1 class="auth-title">PJ Music</h1>
        <p class="auth-subtitle">Apna music, apni duniya 🎵</p>
      </div>
      <form class="auth-form" id="login-form" novalidate>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" id="login-email"
            placeholder="aapka@email.com" autocomplete="email" inputmode="email" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div style="position:relative;">
            <input class="form-input" type="password" id="login-password"
              placeholder="••••••••" autocomplete="current-password" required
              style="padding-right:48px;" />
            <button type="button" id="toggle-pw" style="
              position:absolute;right:12px;top:50%;transform:translateY(-50%);
              background:none;border:none;cursor:pointer;font-size:18px;line-height:1;">
              👁
            </button>
          </div>
        </div>
        <div id="login-error" class="form-error" style="
          display:none;padding:10px 12px;
          background:rgba(239,68,68,0.1);
          border-radius:8px;border-left:3px solid #ef4444;
          font-size:0.875rem;"></div>
        <button type="submit" class="btn btn-primary btn-full" id="login-btn">
          Sign In
        </button>
      </form>
      <div class="auth-footer">
        Account nahi hai?
        <a href="#" id="go-register" style="font-weight:700;color:var(--color-primary);">
          Register karo
        </a>
      </div>
    </div>`;

  document.getElementById('toggle-pw')?.addEventListener('click', () => {
    const pw  = document.getElementById('login-password');
    pw.type   = pw.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('login-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const email    = document.getElementById('login-email').value.trim();
    const password = document.getElementById('login-password').value;
    const btn      = document.getElementById('login-btn');
    const errEl    = document.getElementById('login-error');

    if (!email || !password) {
      errEl.textContent   = 'Email aur password dono bharo.';
      errEl.style.display = 'block';
      return;
    }

    errEl.style.display = 'none';
    btn.disabled        = true;
    btn.textContent     = 'Sign in ho raha hai...';

    try {
      await login(email, password);
      window.dispatchEvent(new CustomEvent('auth:success'));
    } catch (err) {
      errEl.textContent   = err.message || 'Login fail ho gaya. Dobara try karo.';
      errEl.style.display = 'block';
      btn.disabled        = false;
      btn.textContent     = 'Sign In';
    }
  });

  document.getElementById('go-register')?.addEventListener('click', (e) => {
    e.preventDefault();
    renderRegister(container);
  });
};

// ─── Register Page ────────────────────────────────────────────────────────────

export const renderRegister = (container) => {
  container.innerHTML = `
    <div class="auth-page">
      <div class="auth-header">
        ${logoHTML}
        <h1 class="auth-title">Account Banao</h1>
        <p class="auth-subtitle">Aapka apna unique ID aur invite code milega 🎫</p>
      </div>
      <form class="auth-form" id="reg-form" novalidate>
        <div class="form-group">
          <label class="form-label">Aapka Naam</label>
          <input class="form-input" type="text" id="reg-name"
            placeholder="Jaise: Rahul Kumar" autocomplete="name" required />
        </div>
        <div class="form-group">
          <label class="form-label">Email</label>
          <input class="form-input" type="email" id="reg-email"
            placeholder="aapka@email.com" autocomplete="email" inputmode="email" required />
        </div>
        <div class="form-group">
          <label class="form-label">Password</label>
          <div style="position:relative;">
            <input class="form-input" type="password" id="reg-password"
              placeholder="Kam se kam 6 characters" autocomplete="new-password" required
              style="padding-right:48px;" />
            <button type="button" id="toggle-reg-pw" style="
              position:absolute;right:12px;top:50%;transform:translateY(-50%);
              background:none;border:none;cursor:pointer;font-size:18px;line-height:1;">
              👁
            </button>
          </div>
        </div>

        <div style="
          background:rgba(168,85,247,0.08);
          border:1px solid rgba(168,85,247,0.2);
          border-radius:12px;padding:12px 14px;
          font-size:0.8rem;color:var(--text-secondary);line-height:1.8;">
          ✅ Aapka <strong style="color:var(--color-primary);">Unique User ID</strong> milega<br>
          ✅ Aapka <strong style="color:var(--color-primary);">6-digit Invite Code</strong> milega<br>
          ✅ Device ke songs import kar sakte ho<br>
          ✅ Dosto ke saath music sun sakte ho
        </div>

        <div id="reg-error" class="form-error" style="
          display:none;padding:10px 12px;
          background:rgba(239,68,68,0.1);
          border-radius:8px;border-left:3px solid #ef4444;
          font-size:0.875rem;"></div>

        <button type="submit" class="btn btn-primary btn-full" id="reg-btn">
          Account Banao
        </button>
      </form>
      <div class="auth-footer">
        Pehle se account hai?
        <a href="#" id="go-login" style="font-weight:700;color:var(--color-primary);">
          Login karo
        </a>
      </div>
    </div>`;

  document.getElementById('toggle-reg-pw')?.addEventListener('click', () => {
    const pw = document.getElementById('reg-password');
    pw.type  = pw.type === 'password' ? 'text' : 'password';
  });

  document.getElementById('reg-form')?.addEventListener('submit', async (e) => {
    e.preventDefault();
    const name     = document.getElementById('reg-name').value.trim();
    const email    = document.getElementById('reg-email').value.trim();
    const password = document.getElementById('reg-password').value;
    const btn      = document.getElementById('reg-btn');
    const errEl    = document.getElementById('reg-error');

    errEl.style.display = 'none';

    if (!name) {
      errEl.textContent   = 'Naam bharo.';
      errEl.style.display = 'block';
      return;
    }
    if (!email || !email.includes('@')) {
      errEl.textContent   = 'Sahi email bharo.';
      errEl.style.display = 'block';
      return;
    }
    if (password.length < 6) {
      errEl.textContent   = 'Password kam se kam 6 characters ka hona chahiye.';
      errEl.style.display = 'block';
      return;
    }

    btn.disabled    = true;
    btn.textContent = 'Account ban raha hai...';

    try {
      await register(name, email, password);
      window.dispatchEvent(new CustomEvent('auth:success'));
    } catch (err) {
      errEl.textContent   = err.message || 'Registration fail ho gaya.';
      errEl.style.display = 'block';
      btn.disabled        = false;
      btn.textContent     = 'Account Banao';
    }
  });

  document.getElementById('go-login')?.addEventListener('click', (e) => {
    e.preventDefault();
    renderLogin(container);
  });
};

// ─── Forgot Password (redirect to login in local mode) ───────────────────────

export const renderForgotPassword = (container) => {
  renderLogin(container);
};
