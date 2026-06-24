/**
 * Listening Room Model
 * Represents a synchronized listening session room.
 * The room owner controls playback; members stay in sync.
 */

const mongoose = require('mongoose');

const roomSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Room name is required'],
    trim: true,
    maxlength: [80, 'Room name cannot exceed 80 characters'],
  },

  owner: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User',
    required: true,
    index: true,
  },

  // Active members currently in room
  members: [{
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    joinedAt: {
      type: Date,
      default: Date.now,
    },
    socketId: {
      type: String,
      default: null,
    },
  }],

  // Pending invitations
  invitations: [{
    invitee: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
    },
    token: {
      type: String, // secure random token (hashed)
    },
    expiresAt: {
      type: Date,
    },
    status: {
      type: String,
      enum: ['pending', 'accepted', 'declined', 'expired'],
      default: 'pending',
    },
    createdAt: {
      type: Date,
      default: Date.now,
    },
  }],

  // Current playback state (synced to all members)
  playbackState: {
    currentSong: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
      default: null,
    },
    // File path for each member may differ (local file) — members resolve locally
    songTitle: { type: String, default: '' },
    songArtist: { type: String, default: '' },
    isPlaying: { type: Boolean, default: false },
    position: { type: Number, default: 0 }, // seconds
    updatedAt: { type: Date, default: Date.now },
    queue: [{
      type: mongoose.Schema.Types.ObjectId,
      ref: 'Song',
    }],
  },

  // Room settings
  isPrivate: {
    type: Boolean,
    default: true,
  },

  maxMembers: {
    type: Number,
    default: 10,
    min: 2,
    max: 50,
  },

  status: {
    type: String,
    enum: ['active', 'ended'],
    default: 'active',
  },

  endedAt: {
    type: Date,
    default: null,
  },

}, { timestamps: true });

// Indexes
roomSchema.index({ owner: 1 });
roomSchema.index({ status: 1 });
roomSchema.index({ 'members.user': 1 });

const Room = mongoose.model('Room', roomSchema);
module.exports = Room;
