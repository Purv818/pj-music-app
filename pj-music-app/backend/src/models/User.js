/**
 * User Model
 * Handles authentication, profile, and friend relationships.
 */

const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');

const userSchema = new mongoose.Schema({
  username: {
    type: String,
    required: [true, 'Username is required'],
    unique: true,
    trim: true,
    minlength: [3, 'Username must be at least 3 characters'],
    maxlength: [30, 'Username cannot exceed 30 characters'],
    // Only alphanumeric and underscores
    match: [/^[a-zA-Z0-9_]+$/, 'Username can only contain letters, numbers, and underscores'],
  },

  email: {
    type: String,
    required: [true, 'Email is required'],
    unique: true,
    lowercase: true,
    trim: true,
    match: [/^\S+@\S+\.\S+$/, 'Please provide a valid email'],
  },

  password: {
    type: String,
    required: [true, 'Password is required'],
    minlength: [8, 'Password must be at least 8 characters'],
    select: false, // Never return password in queries
  },

  displayName: {
    type: String,
    trim: true,
    maxlength: [50, 'Display name cannot exceed 50 characters'],
  },

  avatar: {
    type: String,
    default: null, // URL or base64
  },

  bio: {
    type: String,
    maxlength: [200, 'Bio cannot exceed 200 characters'],
    default: '',
  },

  role: {
    type: String,
    enum: ['user', 'admin'],
    default: 'user',
  },

  isActive: {
    type: Boolean,
    default: true,
  },

  // Friend system
  friends: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
  }],

  friendRequests: {
    sent: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
    received: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    }],
  },

  // Favorite songs (array of song IDs)
  favorites: [{
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Song',
  }],

  // Password reset
  passwordResetToken: {
    type: String,
    select: false,
  },
  passwordResetExpires: {
    type: Date,
    select: false,
  },

  // Refresh tokens (store hashed)
  refreshTokens: {
    type: [String],
    select: false,
    default: [],
  },

  // Security: track failed login attempts
  loginAttempts: {
    type: Number,
    default: 0,
    select: false,
  },
  lockUntil: {
    type: Date,
    select: false,
  },

  lastSeen: {
    type: Date,
    default: Date.now,
  },

  theme: {
    type: String,
    enum: ['dark', 'light'],
    default: 'dark',
  },

}, { timestamps: true });

// ─── Indexes ─────────────────────────────────────────────────────────────────
userSchema.index({ email: 1 });
userSchema.index({ username: 1 });

// ─── Pre-save: hash password ─────────────────────────────────────────────────
userSchema.pre('save', async function (next) {
  if (!this.isModified('password')) return next();

  const rounds = parseInt(process.env.BCRYPT_ROUNDS) || 12;
  this.password = await bcrypt.hash(this.password, rounds);

  // Clear reset token on password change
  this.passwordResetToken = undefined;
  this.passwordResetExpires = undefined;

  next();
});

// ─── Instance methods ────────────────────────────────────────────────────────

/** Compare plaintext password against hashed */
userSchema.methods.comparePassword = async function (candidatePassword) {
  return bcrypt.compare(candidatePassword, this.password);
};

/** Check if account is currently locked */
userSchema.methods.isLocked = function () {
  return this.lockUntil && this.lockUntil > Date.now();
};

/** Increment failed login counter; lock after 5 attempts for 30 min */
userSchema.methods.incrementLoginAttempts = async function () {
  // Reset if lock has expired
  if (this.lockUntil && this.lockUntil < Date.now()) {
    return this.updateOne({
      $set: { loginAttempts: 1 },
      $unset: { lockUntil: 1 },
    });
  }

  const updates = { $inc: { loginAttempts: 1 } };

  if (this.loginAttempts + 1 >= 5 && !this.isLocked()) {
    updates.$set = { lockUntil: Date.now() + 30 * 60 * 1000 }; // 30 min
  }

  return this.updateOne(updates);
};

/** Reset login attempts on successful login */
userSchema.methods.resetLoginAttempts = async function () {
  return this.updateOne({
    $set: { loginAttempts: 0 },
    $unset: { lockUntil: 1 },
  });
};

// ─── Sanitize output (remove sensitive fields) ───────────────────────────────
userSchema.methods.toSafeObject = function () {
  const obj = this.toObject();
  delete obj.password;
  delete obj.refreshTokens;
  delete obj.loginAttempts;
  delete obj.lockUntil;
  delete obj.passwordResetToken;
  delete obj.passwordResetExpires;
  return obj;
};

const User = mongoose.model('User', userSchema);
module.exports = User;
