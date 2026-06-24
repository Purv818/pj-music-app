/**
 * Winston logger utility.
 * Logs to console (dev) and files (prod).
 * Sensitive data should never be passed to logger directly.
 */

const winston = require('winston');
const path = require('path');

const { combine, timestamp, printf, colorize, errors } = winston.format;

// Custom log format
const logFormat = printf(({ level, message, timestamp, stack }) => {
  return `${timestamp} [${level}]: ${stack || message}`;
});

const logger = winston.createLogger({
  level: process.env.NODE_ENV === 'production' ? 'warn' : 'debug',
  format: combine(
    timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
    errors({ stack: true }),
    logFormat
  ),
  transports: [
    // Console (always)
    new winston.transports.Console({
      format: combine(
        colorize(),
        timestamp({ format: 'YYYY-MM-DD HH:mm:ss' }),
        errors({ stack: true }),
        logFormat
      ),
    }),
  ],
});

// In production, also write to files
if (process.env.NODE_ENV === 'production') {
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, '../../logs/error.log'),
    level: 'error',
    maxsize: 5 * 1024 * 1024, // 5MB
    maxFiles: 5,
  }));
  logger.add(new winston.transports.File({
    filename: path.join(__dirname, '../../logs/combined.log'),
    maxsize: 5 * 1024 * 1024,
    maxFiles: 5,
  }));
}

module.exports = logger;
