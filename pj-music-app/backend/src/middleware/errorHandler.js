/**
 * Global Error Handler Middleware
 * Catches all unhandled errors, normalizes them, and sends a safe response.
 * Never expose stack traces or internal details to clients in production.
 */

const logger = require('../utils/logger');

const errorHandler = (err, req, res, next) => {
  let statusCode = err.statusCode || 500;
  let message = err.message || 'Internal Server Error';

  // Log full error details server-side
  logger.error(`${req.method} ${req.path} — ${err.stack || err.message}`);

  // Handle specific Mongoose errors
  if (err.name === 'ValidationError') {
    statusCode = 422;
    const messages = Object.values(err.errors).map((e) => e.message);
    message = messages.join('. ');
  }

  if (err.code === 11000) {
    // Duplicate key error
    statusCode = 409;
    const field = Object.keys(err.keyValue || {})[0] || 'field';
    message = `A user with that ${field} already exists.`;
  }

  if (err.name === 'CastError') {
    statusCode = 400;
    message = `Invalid ${err.path}: ${err.value}`;
  }

  if (err.name === 'JsonWebTokenError') {
    statusCode = 401;
    message = 'Invalid token.';
  }

  if (err.name === 'TokenExpiredError') {
    statusCode = 401;
    message = 'Token expired.';
  }

  // Never expose internals in production
  const response = {
    success: false,
    message: process.env.NODE_ENV === 'production' && statusCode === 500
      ? 'Internal Server Error'
      : message,
  };

  if (process.env.NODE_ENV === 'development') {
    response.stack = err.stack;
  }

  res.status(statusCode).json(response);
};

module.exports = errorHandler;
