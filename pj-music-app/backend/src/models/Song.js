/**
 * Song Model
 * Represents a song entry scanned/added by a user.
 * Actual audio files live on device; this stores metadata.
 */

const mongoose = require('mongoose');

const songSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Core metadata
  title: {
    type: String,
    required: [true, 'Song title is required'],
    trim: true,
    maxlength: [200, 'Title cannot exceed 200 characters'],
  },

  artist: {
    type: String,
    trim: true,
    default: 'Unknown Artist',
    maxlength: [100, 'Artist name cannot exceed 100 characters'],
  },

  album: {
    type: String,
    trim: true,
    default: 'Unknown Album',
    maxlength: [100, 'Album name cannot exceed 100 characters'],
  },

  genre: {
    type: String,
    trim: true,
    default: '',
    maxlength: [50, 'Genre cannot exceed 50 characters'],
  },

  duration: {
    type: Number, // in seconds
    default: 0,
    min: 0,
  },

  // Local file path (device-specific, used by Capacitor)
  filePath: {
    type: String,
    required: [true, 'File path is required'],
    trim: true,
  },

  // File info
  fileSize: {
    type: Number, // bytes
    default: 0,
  },

  mimeType: {
    type: String,
    default: 'audio/mpeg',
  },

  // Track / disc numbers
  trackNumber: {
    type: Number,
    default: 0,
  },

  year: {
    type: Number,
    default: null,
  },

  // Album art (base64 or URL)
  artwork: {
    type: String,
    default: null,
  },

  // Play stats
  playCount: {
    type: Number,
    default: 0,
  },

  lastPlayed: {
    type: Date,
    default: null,
  },

  // Soft delete flag
  isDeleted: {
    type: Boolean,
    default: false,
  },

}, { timestamps: true });

// ─── Indexes ─────────────────────────────────────────────────────────────────
songSchema.index({ owner: 1, title: 1 });
songSchema.index({ owner: 1, artist: 1 });
songSchema.index({ owner: 1, album: 1 });
// Full-text search index
songSchema.index({ title: 'text', artist: 'text', album: 'text', genre: 'text' });

// ─── Only return non-deleted songs by default ────────────────────────────────
songSchema.pre(/^find/, function (next) {
  if (this._conditions.isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

const Song = mongoose.model('Song', songSchema);
module.exports = Song;
