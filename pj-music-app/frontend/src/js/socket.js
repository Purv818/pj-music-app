/**
 * Socket.IO Client
 * Manages the WebSocket connection, reconnection, and real-time sync events.
 * Compatible with Capacitor/Android and browser environments.
 */

import CONFIG from './config.js';
import storage from './storage.js';
import { toast } from './ui.js';

let socket = null;
let ioLib = null;
const eventHandlers = {};

/**
 * Lazily load the Socket.IO client library.
 * Supports both module import and global window.io fallback.
 */
const loadIo = async () => {
  if (ioLib) return ioLib;

  // Try importing as an ES module
  try {
    const mod = await import('https://cdn.socket.io/4.6.1/socket.io.esm.min.js');
    ioLib = mod.io;
    return ioLib;
  } catch (_) {}

  // Fallback: use global window.io (injected by bundler or CDN script tag)
  if (typeof window !== 'undefined' && window.io) {
    ioLib = window.io;
    return ioLib;
  }

  console.warn('Socket.IO client library not available.');
  return null;
};

/**
 * Connect to the Socket.IO server.
 * In DEMO MODE, skips connection silently.
 */
export const connectSocket = async () => {
  // Demo mode — no real server, skip silently
  if (typeof window !== 'undefined' && !window._socketEnabled) {
    console.log('[Socket] Demo mode — skipping connection.');
    return;
  }

  const [token, io] = await Promise.all([
    storage.get(CONFIG.TOKEN_KEY),
    loadIo(),
  ]);

  if (!token || !io) return;

  socket = io(CONFIG.SOCKET_URL, {
    auth: { token },
    transports: ['websocket'],
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
    timeout: 10000,
  });

  socket.on('connect', () => {
    console.log('[Socket] Connected:', socket.id);
    // Re-register all pending event listeners after reconnect
    Object.entries(eventHandlers).forEach(([event, handlers]) => {
      handlers.forEach((fn) => socket.on(event, fn));
    });
  });

  socket.on('connect_error', (err) => {
    console.error('[Socket] Connection error:', err.message);
    if (err.message.includes('Authentication')) {
      toast('Session expired. Please log in again.', 'error');
    }
  });

  socket.on('disconnect', (reason) => {
    console.log('[Socket] Disconnected:', reason);
  });

  socket.on('error', (err) => {
    console.error('[Socket] Error:', err);
    if (err?.message) {
      toast(err.message, 'error');
    }
  });
};

/**
 * Disconnect the socket gracefully.
 */
export const disconnectSocket = () => {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
};

/**
 * Emit an event to the server.
 * @param {string} event
 * @param {*} data
 */
export const emit = (event, data) => {
  if (socket?.connected) {
    socket.emit(event, data);
  } else {
    console.warn(`[Socket] Cannot emit "${event}" — not connected.`);
  }
};

/**
 * Register an event listener.
 * Persists through reconnects.
 * @param {string} event
 * @param {Function} handler
 */
export const on = (event, handler) => {
  if (!eventHandlers[event]) eventHandlers[event] = [];
  if (!eventHandlers[event].includes(handler)) {
    eventHandlers[event].push(handler);
  }
  if (socket?.connected) {
    socket.on(event, handler);
  }
};

/**
 * Remove an event listener.
 * @param {string} event
 * @param {Function} handler
 */
export const off = (event, handler) => {
  if (eventHandlers[event]) {
    eventHandlers[event] = eventHandlers[event].filter((h) => h !== handler);
  }
  socket?.off(event, handler);
};

/**
 * Get the raw Socket.IO socket instance.
 * @returns {import('socket.io-client').Socket|null}
 */
export const getSocket = () => socket;

/**
 * Check if the socket is currently connected.
 * @returns {boolean}
 */
export const isConnected = () => socket?.connected === true;
