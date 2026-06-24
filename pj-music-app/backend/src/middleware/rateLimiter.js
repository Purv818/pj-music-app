/**
 * Rate Limiting Middleware
 * Uses express-rate-limit to protect against brute-force and DoS attacks.
 */

const rateLimit = require('express-rate-limit');
const { sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

/**
 * General API rate limiter — 100 requests per 15 minutes.
 */
const apiLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.RATE_LIMIT_MAX) || 100,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Rate limit exceeded: IP=${req.ip}, path=${req.path}`);
    sendError(res, 429, 'Too many requests. Please try again later.');
  },
});

/**
 * Strict auth rate limiter — 10 requests per 15 minutes.
 * Applied to login/register/forgot-password.
 */
const authLimiter = rateLimit({
  windowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS) || 15 * 60 * 1000,
  max: parseInt(process.env.AUTH_RATE_LIMIT_MAX) || 10,
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    logger.warn(`Auth rate limit exceeded: IP=${req.ip}, path=${req.path}`);
    sendError(res, 429, 'Too many authentication attempts. Please try again later.');
  },
});

module.exports = { apiLimiter, authLimiter };
