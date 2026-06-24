/**
 * JWT token utilities.
 * Handles signing, verifying, and refreshing access/refresh tokens.
 */

const jwt = require('jsonwebtoken');
const crypto = require('crypto');

/**
 * Sign a JWT access token.
 * @param {string} userId
 * @returns {string} signed JWT
 */
const signAccessToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'access' },
    process.env.JWT_SECRET,
    { expiresIn: process.env.JWT_EXPIRES_IN || '15m' }
  );
};

/**
 * Sign a JWT refresh token.
 * @param {string} userId
 * @returns {string} signed JWT
 */
const signRefreshToken = (userId) => {
  return jwt.sign(
    { id: userId, type: 'refresh' },
    process.env.JWT_REFRESH_SECRET,
    { expiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d' }
  );
};

/**
 * Verify an access token.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyAccessToken = (token) => {
  return jwt.verify(token, process.env.JWT_SECRET);
};

/**
 * Verify a refresh token.
 * @param {string} token
 * @returns {object} decoded payload
 */
const verifyRefreshToken = (token) => {
  return jwt.verify(token, process.env.JWT_REFRESH_SECRET);
};

/**
 * Generate a cryptographically secure random token (for email resets, invitations).
 * @param {number} bytes - number of random bytes (default 32)
 * @returns {string} hex token
 */
const generateSecureToken = (bytes = 32) => {
  return crypto.randomBytes(bytes).toString('hex');
};

/**
 * Hash a raw token for safe DB storage (SHA-256).
 * @param {string} token
 * @returns {string} hashed token
 */
const hashToken = (token) => {
  return crypto.createHash('sha256').update(token).digest('hex');
};

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
};
