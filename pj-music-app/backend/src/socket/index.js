/**
 * Socket.IO Entry Point
 * Initializes all socket namespaces and middleware.
 */

const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');
const logger = require('../utils/logger');
const { handleRoomEvents } = require('./roomHandler');
const { handleSyncEvents } = require('./syncHandler');

/**
 * Socket authentication middleware.
 * Client must send: { auth: { token: "<access_token>" } }
 */
const socketAuthMiddleware = async (socket, next) => {
  try {
    const token = socket.handshake.auth?.token;

    if (!token) {
      return next(new Error('Authentication required.'));
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      return next(new Error('Invalid or expired token.'));
    }

    const user = await User.findById(decoded.id).select('username displayName avatar isActive');
    if (!user || !user.isActive) {
      return next(new Error('User not found or deactivated.'));
    }

    socket.user = user; // Attach user to socket
    next();
  } catch (err) {
    logger.error(`Socket auth error: ${err.message}`);
    next(new Error('Authentication failed.'));
  }
};

/**
 * Initialize Socket.IO with all handlers.
 * @param {import('socket.io').Server} io
 */
const initSocket = (io) => {
  // Apply auth middleware to all connections
  io.use(socketAuthMiddleware);

  io.on('connection', (socket) => {
    const user = socket.user;
    logger.info(`Socket connected: ${user.username} (${socket.id})`);

    // Join personal notification room
    socket.join(`user:${user._id}`);

    // Register event handlers
    handleRoomEvents(io, socket);
    handleSyncEvents(io, socket);

    // Update last seen
    User.findByIdAndUpdate(user._id, { lastSeen: new Date() }).catch(() => {});

    socket.on('disconnect', (reason) => {
      logger.info(`Socket disconnected: ${user.username} — ${reason}`);
    });

    socket.on('error', (err) => {
      logger.error(`Socket error from ${user.username}: ${err.message}`);
    });
  });

  logger.info('Socket.IO initialized.');
};

module.exports = { initSocket };
