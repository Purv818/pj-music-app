/**
 * User Controller
 * Profile management, theme preference, account deletion.
 */

const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── Get user profile (public) ────────────────────────────────────────────────

exports.getProfile = async (req, res, next) => {
  try {
    const user = await User.findById(req.params.id)
      .select('username displayName avatar bio lastSeen')
      .lean();

    if (!user) return sendError(res, 404, 'User not found.');

    return sendSuccess(res, 200, 'Profile retrieved.', user);
  } catch (error) {
    next(error);
  }
};

// ─── Update own profile ────────────────────────────────────────────────────────

exports.updateProfile = async (req, res, next) => {
  try {
    const allowedFields = ['displayName', 'bio', 'avatar', 'theme'];
    const updates = {};

    allowedFields.forEach((field) => {
      if (req.body[field] !== undefined) {
        updates[field] = req.body[field];
      }
    });

    if (Object.keys(updates).length === 0) {
      return sendError(res, 400, 'No valid fields to update.');
    }

    const user = await User.findByIdAndUpdate(
      req.user._id,
      { $set: updates },
      { new: true, runValidators: true }
    );

    return sendSuccess(res, 200, 'Profile updated.', user.toSafeObject());
  } catch (error) {
    next(error);
  }
};

// ─── Change password ─────────────────────────────────────────────────────────

exports.changePassword = async (req, res, next) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return sendError(res, 400, 'Current and new password are required.');
    }

    const user = await User.findById(req.user._id).select('+password +refreshTokens');

    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return sendError(res, 401, 'Current password is incorrect.');
    }

    if (newPassword.length < 8) {
      return sendError(res, 400, 'New password must be at least 8 characters.');
    }

    user.password = newPassword;
    // Revoke all refresh tokens on password change (force re-login on all devices)
    user.refreshTokens = [];
    await user.save();

    logger.info(`Password changed for user: ${user.email}`);

    return sendSuccess(res, 200, 'Password changed. Please log in again on all devices.');
  } catch (error) {
    next(error);
  }
};

// ─── Deactivate own account ───────────────────────────────────────────────────

exports.deactivateAccount = async (req, res, next) => {
  try {
    await User.findByIdAndUpdate(req.user._id, { isActive: false });
    logger.info(`Account deactivated: ${req.user.email}`);
    return sendSuccess(res, 200, 'Account deactivated.');
  } catch (error) {
    next(error);
  }
};

// ─── Search users (by username or displayName) ────────────────────────────────

exports.searchUsers = async (req, res, next) => {
  try {
    const { q } = req.query;
    if (!q || q.trim().length < 2) {
      return sendError(res, 400, 'Search query must be at least 2 characters.');
    }

    const regex = new RegExp(q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'), 'i');

    const users = await User.find({
      $or: [{ username: regex }, { displayName: regex }],
      isActive: true,
      _id: { $ne: req.user._id }, // exclude self
    })
      .select('username displayName avatar lastSeen')
      .limit(20)
      .lean();

    return sendSuccess(res, 200, 'Search results.', users);
  } catch (error) {
    next(error);
  }
};
