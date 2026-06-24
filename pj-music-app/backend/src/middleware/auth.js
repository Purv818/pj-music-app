/**
 * Authentication Middleware
 * Verifies JWT access tokens on protected routes.
 * Implements role-based access control (RBAC).
 */

const { verifyAccessToken } = require('../utils/tokenUtils');
const User = require('../models/User');
const { sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * Protect route — require valid JWT access token.
 */
const protect = async (req, res, next) => {
  try {
    // Extract token from Authorization header: "Bearer <token>"
    let token;
    if (
      req.headers.authorization &&
      req.headers.authorization.startsWith('Bearer ')
    ) {
      token = req.headers.authorization.split(' ')[1];
    }

    if (!token) {
      return sendError(res, 401, 'Access denied. No token provided.');
    }

    // Verify token signature and expiry
    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (err) {
      if (err.name === 'TokenExpiredError') {
        return sendError(res, 401, 'Token expired. Please refresh.');
      }
      logger.warn(`Invalid token attempt from IP: ${req.ip}`);
      return sendError(res, 401, 'Invalid token.');
    }

    // Confirm token type
    if (decoded.type !== 'access') {
      return sendError(res, 401, 'Invalid token type.');
    }

    // Fetch user (ensure account still exists and is active)
    const user = await User.findById(decoded.id).select('-password -refreshTokens');
    if (!user) {
      return sendError(res, 401, 'User no longer exists.');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account has been deactivated.');
    }

    // Attach user to request
    req.user = user;
    next();

  } catch (error) {
    logger.error(`Auth middleware error: ${error.message}`);
    return sendError(res, 500, 'Authentication error.');
  }
};

/**
 * Restrict access to specific roles.
 * Usage: restrictTo('admin', 'moderator')
 */
const restrictTo = (...roles) => {
  return (req, res, next) => {
    if (!roles.includes(req.user.role)) {
      return sendError(res, 403, 'You do not have permission to perform this action.');
    }
    next();
  };
};

module.exports = { protect, restrictTo };
