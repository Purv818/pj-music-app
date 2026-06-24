/**
 * Input Validation Middleware
 * Uses express-validator. Collects all errors and returns them in a consistent format.
 */

const { validationResult, body, param, query } = require('express-validator');
const { sendError } = require('../utils/apiResponse');

/**
 * Run after a chain of validators.
 * If there are validation errors, send 422 response with error details.
 */
const handleValidationErrors = (req, res, next) => {
  const errors = validationResult(req);
  if (!errors.isEmpty()) {
    return sendError(res, 422, 'Validation failed', errors.array());
  }
  next();
};

// ─── Auth validators ─────────────────────────────────────────────────────────

const validateRegister = [
  body('username')
    .trim()
    .isLength({ min: 3, max: 30 }).withMessage('Username must be 3–30 characters')
    .matches(/^[a-zA-Z0-9_]+$/).withMessage('Username can only contain letters, numbers, underscores'),

  body('email')
    .trim()
    .isEmail().withMessage('Please provide a valid email')
    .normalizeEmail(),

  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Password must contain at least one number')
    .matches(/[A-Z]/).withMessage('Password must contain at least one uppercase letter'),

  handleValidationErrors,
];

const validateLogin = [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),

  body('password')
    .notEmpty().withMessage('Password is required'),

  handleValidationErrors,
];

const validateForgotPassword = [
  body('email')
    .trim()
    .isEmail().withMessage('Valid email required')
    .normalizeEmail(),

  handleValidationErrors,
];

const validateResetPassword = [
  body('password')
    .isLength({ min: 8 }).withMessage('Password must be at least 8 characters')
    .matches(/\d/).withMessage('Must contain at least one number')
    .matches(/[A-Z]/).withMessage('Must contain at least one uppercase letter'),

  handleValidationErrors,
];

// ─── Song validators ─────────────────────────────────────────────────────────

const validateSong = [
  body('title')
    .trim()
    .notEmpty().withMessage('Song title is required')
    .isLength({ max: 200 }).withMessage('Title cannot exceed 200 characters'),

  body('artist')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Artist cannot exceed 100 characters'),

  body('album')
    .optional()
    .trim()
    .isLength({ max: 100 }).withMessage('Album cannot exceed 100 characters'),

  body('filePath')
    .notEmpty().withMessage('File path is required'),

  handleValidationErrors,
];

// ─── Playlist validators ──────────────────────────────────────────────────────

const validatePlaylist = [
  body('name')
    .trim()
    .notEmpty().withMessage('Playlist name is required')
    .isLength({ max: 100 }).withMessage('Name cannot exceed 100 characters'),

  handleValidationErrors,
];

// ─── Room validators ─────────────────────────────────────────────────────────

const validateRoom = [
  body('name')
    .trim()
    .notEmpty().withMessage('Room name is required')
    .isLength({ max: 80 }).withMessage('Room name cannot exceed 80 characters'),

  handleValidationErrors,
];

// ─── ID param validator ──────────────────────────────────────────────────────

const validateMongoId = (paramName = 'id') => [
  param(paramName)
    .isMongoId().withMessage(`Invalid ${paramName}`),
  handleValidationErrors,
];

module.exports = {
  validateRegister,
  validateLogin,
  validateForgotPassword,
  validateResetPassword,
  validateSong,
  validatePlaylist,
  validateRoom,
  validateMongoId,
  handleValidationErrors,
};
