/**
 * Auth Controller
 * Handles registration, login, token refresh, logout, and password reset.
 */

const User = require('../models/User');
const {
  signAccessToken,
  signRefreshToken,
  verifyRefreshToken,
  generateSecureToken,
  hashToken,
} = require('../utils/tokenUtils');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const { sendPasswordResetEmail } = require('../services/emailService');
const logger = require('../utils/logger');

// ─── Register ────────────────────────────────────────────────────────────────

exports.register = async (req, res, next) => {
  try {
    const { username, email, password, displayName } = req.body;

    // Check for duplicate email or username
    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      const field = existing.email === email ? 'email' : 'username';
      return sendError(res, 409, `An account with that ${field} already exists.`);
    }

    const user = await User.create({
      username,
      email,
      password,
      displayName: displayName || username,
    });

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    // Store hashed refresh token
    const hashed = hashToken(refreshToken);
    user.refreshTokens = [hashed];
    await user.save({ validateBeforeSave: false });

    logger.info(`New user registered: ${user.email}`);

    return sendSuccess(res, 201, 'Account created successfully.', {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

// ─── Login ────────────────────────────────────────────────────────────────────

exports.login = async (req, res, next) => {
  try {
    const { email, password } = req.body;

    // Always select password and security fields explicitly
    const user = await User.findOne({ email }).select(
      '+password +loginAttempts +lockUntil +refreshTokens'
    );

    if (!user) {
      // Vague message to prevent user enumeration
      return sendError(res, 401, 'Invalid email or password.');
    }

    // Check account lock
    if (user.isLocked()) {
      logger.warn(`Locked account login attempt: ${email} from IP: ${req.ip}`);
      return sendError(res, 423, 'Account temporarily locked due to too many failed attempts. Try again in 30 minutes.');
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      await user.incrementLoginAttempts();
      logger.warn(`Failed login attempt: ${email} from IP: ${req.ip}`);
      return sendError(res, 401, 'Invalid email or password.');
    }

    if (!user.isActive) {
      return sendError(res, 403, 'Account has been deactivated.');
    }

    // Successful login
    await user.resetLoginAttempts();
    user.lastSeen = Date.now();

    const accessToken = signAccessToken(user._id);
    const refreshToken = signRefreshToken(user._id);

    // Rotate refresh tokens (keep max 5 devices)
    const hashed = hashToken(refreshToken);
    user.refreshTokens = [...(user.refreshTokens || []).slice(-4), hashed];
    await user.save({ validateBeforeSave: false });

    logger.info(`User logged in: ${user.email}`);

    return sendSuccess(res, 200, 'Login successful.', {
      accessToken,
      refreshToken,
      user: user.toSafeObject(),
    });
  } catch (error) {
    next(error);
  }
};

// ─── Refresh Token ─────────────────────────────────────────────────────────

exports.refreshToken = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (!refreshToken) {
      return sendError(res, 401, 'Refresh token required.');
    }

    let decoded;
    try {
      decoded = verifyRefreshToken(refreshToken);
    } catch (err) {
      return sendError(res, 401, 'Invalid or expired refresh token.');
    }

    if (decoded.type !== 'refresh') {
      return sendError(res, 401, 'Invalid token type.');
    }

    const user = await User.findById(decoded.id).select('+refreshTokens');
    if (!user) {
      return sendError(res, 401, 'User not found.');
    }

    // Verify hashed token is in the user's list (token rotation check)
    const hashed = hashToken(refreshToken);
    if (!user.refreshTokens.includes(hashed)) {
      // Token reuse detected — revoke all tokens (possible token theft)
      user.refreshTokens = [];
      await user.save({ validateBeforeSave: false });
      logger.warn(`Refresh token reuse detected for user: ${user._id}`);
      return sendError(res, 401, 'Token reuse detected. Please log in again.');
    }

    // Issue new token pair
    const newAccessToken = signAccessToken(user._id);
    const newRefreshToken = signRefreshToken(user._id);
    const newHashed = hashToken(newRefreshToken);

    // Remove old token, add new one
    user.refreshTokens = user.refreshTokens.filter((t) => t !== hashed);
    user.refreshTokens.push(newHashed);
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, 200, 'Tokens refreshed.', {
      accessToken: newAccessToken,
      refreshToken: newRefreshToken,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Logout ───────────────────────────────────────────────────────────────────

exports.logout = async (req, res, next) => {
  try {
    const { refreshToken } = req.body;

    if (refreshToken) {
      const user = await User.findById(req.user._id).select('+refreshTokens');
      if (user) {
        const hashed = hashToken(refreshToken);
        user.refreshTokens = (user.refreshTokens || []).filter((t) => t !== hashed);
        await user.save({ validateBeforeSave: false });
      }
    }

    return sendSuccess(res, 200, 'Logged out successfully.');
  } catch (error) {
    next(error);
  }
};

// ─── Forgot Password ─────────────────────────────────────────────────────────

exports.forgotPassword = async (req, res, next) => {
  try {
    const { email } = req.body;

    // Always return success to prevent user enumeration
    const user = await User.findOne({ email });

    if (user) {
      const resetToken = generateSecureToken();
      user.passwordResetToken = hashToken(resetToken);
      user.passwordResetExpires = Date.now() + 10 * 60 * 1000; // 10 minutes
      await user.save({ validateBeforeSave: false });

      // Send email (fire-and-forget; don't let email failure block response)
      sendPasswordResetEmail(user.email, resetToken).catch((err) => {
        logger.error(`Failed to send reset email to ${user.email}: ${err.message}`);
      });
    }

    return sendSuccess(
      res,
      200,
      'If that email exists, a password reset link has been sent.'
    );
  } catch (error) {
    next(error);
  }
};

// ─── Reset Password ───────────────────────────────────────────────────────────

exports.resetPassword = async (req, res, next) => {
  try {
    const { token } = req.params;
    const { password } = req.body;

    const hashedToken = hashToken(token);

    const user = await User.findOne({
      passwordResetToken: hashedToken,
      passwordResetExpires: { $gt: Date.now() },
    }).select('+passwordResetToken +passwordResetExpires');

    if (!user) {
      return sendError(res, 400, 'Reset token is invalid or has expired.');
    }

    user.password = password;
    // Pre-save hook will hash the password and clear reset fields
    await user.save();

    logger.info(`Password reset for user: ${user.email}`);

    return sendSuccess(res, 200, 'Password reset successful. Please log in.');
  } catch (error) {
    next(error);
  }
};

// ─── Get current user ─────────────────────────────────────────────────────────

exports.getMe = async (req, res, next) => {
  try {
    return sendSuccess(res, 200, 'User retrieved.', req.user.toSafeObject());
  } catch (error) {
    next(error);
  }
};
