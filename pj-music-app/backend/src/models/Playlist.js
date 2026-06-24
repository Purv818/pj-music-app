/**
 * Playlist Model
 * User-created playlists containing ordered song references.
 */

const mongoose = require('mongoose');

const playlistSchema = new mongoose.Schema({
  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  name: {
    type: String,
    required: [true, 'Playlist name is required'],
    trim: true,
    maxlength: [100, 'Playlist name cannot exceed 100 characters'],
  },

  description: {
    type: String,
    trim: true,
    maxlength: [300, 'Description cannot exceed 300 characters'],
    default: '',
  },

  artwork: {
    type: String,
    default: null, // URL or base64
  },

  // Ordered list of songs
  songs: [{
    song: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      required: true,
    },
    addedAt: {
      type: Date,
      default: Date.now,
    },
  }],

  // Visibility: private (only owner) or shared (friends can view)
  isPublic: {
    type: Boolean,
    default: false,
  },

  isDeleted: {
    type: Boolean,
    default: false,
  },

}, { timestamps: true });

// Indexes
playlistSchema.index({ owner: 1 });
playlistSchema.index({ name: 'text' });

// Filter deleted playlists by default
playlistSchema.pre(/^find/, function (next) {
  if (this._conditions.isDeleted === undefined) {
    this.where({ isDeleted: false });
  }
  next();
});

const Playlist = mongoose.model('Playlist', playlistSchema);
module.exports = Playlist;
