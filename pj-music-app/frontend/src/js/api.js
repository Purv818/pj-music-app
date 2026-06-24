/**
 * API Client
 * Centralized HTTP client with JWT auth, automatic token refresh,
 * and consistent error handling.
 *
 * DEMO MODE: When backend is unavailable, all calls are intercepted
 * by mockApi which returns realistic fake data.
 */

import CONFIG from './config.js';
import storage from './storage.js';
import { toast } from './ui.js';
import { mockApi } from './mock.js';

// ─── Demo Mode Detection ──────────────────────────────────────────────────────
// Set to true to always use mock data (no backend needed)
const DEMO_MODE = true;

let isRefreshing = false;
let refreshQueue = []; // Pending requests waiting for token refresh

/**
 * Process queued requests after token refresh completes.
 */
const processQueue = (error, token = null) => {
  refreshQueue.forEach(({ resolve, reject }) => {
    if (error) reject(error);
    else resolve(token);
  });
  refreshQueue = [];
};

/**
 * Core fetch wrapper with auth, retry on 401, and error normalization.
 * @param {string} endpoint - path relative to API_BASE_URL
 * @param {RequestInit} options - fetch options
 * @returns {Promise<object>} parsed JSON response body
 */
const request = async (endpoint, options = {}) => {
  const url = `${CONFIG.API_BASE_URL}${endpoint}`;
  const accessToken = await storage.get(CONFIG.TOKEN_KEY);

  const headers = {
    'Content-Type': 'application/json',
    ...options.headers,
  };

  if (accessToken) {
    headers['Authorization'] = `Bearer ${accessToken}`;
  }

  const config = {
    ...options,
    headers,
  };

  let response = await fetch(url, config);

  // Handle 401 — try to refresh the token once
  if (response.status === 401 && !options._retry) {
    if (isRefreshing) {
      // Queue this request until the refresh completes
      return new Promise((resolve, reject) => {
        refreshQueue.push({ resolve, reject });
      }).then((newToken) => {
        headers['Authorization'] = `Bearer ${newToken}`;
        return request(endpoint, { ...options, _retry: true, headers });
      });
    }

    isRefreshing = true;

    try {
      const refreshToken = await storage.get(CONFIG.REFRESH_TOKEN_KEY);
      if (!refreshToken) throw new Error('No refresh token');

      const refreshResp = await fetch(`${CONFIG.API_BASE_URL}/auth/refresh-token`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ refreshToken }),
      });

      const refreshData = await refreshResp.json();

      if (!refreshResp.ok || !refreshData.data?.accessToken) {
        throw new Error('Refresh failed');
      }

      const { accessToken: newToken, refreshToken: newRefresh } = refreshData.data;
      await storage.set(CONFIG.TOKEN_KEY, newToken);
      await storage.set(CONFIG.REFRESH_TOKEN_KEY, newRefresh);

      processQueue(null, newToken);
      isRefreshing = false;

      headers['Authorization'] = `Bearer ${newToken}`;
      return request(endpoint, { ...options, _retry: true, headers });

    } catch (err) {
      processQueue(err, null);
      isRefreshing = false;
      // Clear auth state and redirect to login
      await storage.remove(CONFIG.TOKEN_KEY);
      await storage.remove(CONFIG.REFRESH_TOKEN_KEY);
      await storage.remove(CONFIG.USER_KEY);
      window.dispatchEvent(new CustomEvent('auth:logout'));
      throw err;
    }
  }

  // Parse JSON response
  let data;
  try {
    data = await response.json();
  } catch {
    data = { success: false, message: 'Invalid server response.' };
  }

  if (!response.ok) {
    const error = new Error(data.message || `HTTP ${response.status}`);
    error.status = response.status;
    error.data = data;
    throw error;
  }

  return data;
};

// ─── Convenience methods ─────────────────────────────────────────────────────

export const api = {
  get:    (endpoint, options) => DEMO_MODE ? mockApi.get(endpoint)        : request(endpoint, { method: 'GET', ...options }),
  post:   (endpoint, body, options) => DEMO_MODE ? mockApi.post(endpoint, body)   : request(endpoint, { method: 'POST',   body: JSON.stringify(body), ...options }),
  patch:  (endpoint, body, options) => DEMO_MODE ? mockApi.patch(endpoint, body)  : request(endpoint, { method: 'PATCH',  body: JSON.stringify(body), ...options }),
  put:    (endpoint, body, options) => DEMO_MODE ? mockApi.put(endpoint, body)    : request(endpoint, { method: 'PUT',    body: JSON.stringify(body), ...options }),
  delete: (endpoint, options)       => DEMO_MODE ? mockApi.delete(endpoint)       : request(endpoint, { method: 'DELETE', ...options }),
};

export default api;
