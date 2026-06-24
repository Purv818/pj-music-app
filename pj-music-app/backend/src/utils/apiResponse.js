/**
 * Standardized API response helpers.
 * All controllers should use these to ensure consistent response shape.
 */

/**
 * Send a success response.
 * @param {object} res - Express response object
 * @param {number} statusCode
 * @param {string} message
 * @param {*} data
 */
const sendSuccess = (res, statusCode = 200, message = 'Success', data = null) => {
  const response = { success: true, message };
  if (data !== null) response.data = data;
  return res.status(statusCode).json(response);
};

/**
 * Send an error response.
 * @param {object} res - Express response object
 * @param {number} statusCode
 * @param {string} message
 * @param {*} errors - optional validation errors array
 */
const sendError = (res, statusCode = 500, message = 'Internal Server Error', errors = null) => {
  const response = { success: false, message };
  if (errors !== null) response.errors = errors;
  return res.status(statusCode).json(response);
};

module.exports = { sendSuccess, sendError };
