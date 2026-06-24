/**
 * Room Controller
 * Create/manage listening rooms, invite friends, join/leave rooms.
 */

const Room = require('../models/Room');
const User = require('../models/User');
const { generateSecureToken, hashToken } = require('../utils/tokenUtils');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── Create room ──────────────────────────────────────────────────────────────

exports.createRoom = async (req, res, next) => {
  try {
    const { name, isPrivate = true, maxMembers = 10 } = req.body;

    const room = await Room.create({
      name,
      owner: req.user._id,
      isPrivate,
      maxMembers: Math.min(maxMembers, 50),
      members: [{ user: req.user._id }],
    });

    logger.info(`Room created: ${room._id} by ${req.user._id}`);

    return sendSuccess(res, 201, 'Room created.', room);
  } catch (error) {
    next(error);
  }
};

// ─── Get room ─────────────────────────────────────────────────────────────────

exports.getRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id)
      .populate('owner', 'username displayName avatar')
      .populate('members.user', 'username displayName avatar')
      .populate('playbackState.currentSong');

    if (!room || room.status === 'ended') {
      return sendError(res, 404, 'Room not found.');
    }

    // Check membership
    const isMember = room.members.some((m) => m.user._id.equals(req.user._id));
    if (!isMember && room.isPrivate) {
      return sendError(res, 403, 'Access denied. Room is private.');
    }

    return sendSuccess(res, 200, 'Room retrieved.', room);
  } catch (error) {
    next(error);
  }
};

// ─── Get my rooms ─────────────────────────────────────────────────────────────

exports.getMyRooms = async (req, res, next) => {
  try {
    const rooms = await Room.find({
      $or: [{ owner: req.user._id }, { 'members.user': req.user._id }],
      status: 'active',
    })
      .populate('owner', 'username displayName')
      .select('name owner members status isPrivate createdAt')
      .lean();

    return sendSuccess(res, 200, 'Rooms retrieved.', rooms);
  } catch (error) {
    next(error);
  }
};

// ─── Invite friend to room ────────────────────────────────────────────────────

exports.inviteToRoom = async (req, res, next) => {
  try {
    const { inviteeId } = req.body;

    const room = await Room.findOne({ _id: req.params.id, owner: req.user._id, status: 'active' });
    if (!room) return sendError(res, 404, 'Room not found or you are not the owner.');

    // Check invitee exists
    const invitee = await User.findById(inviteeId);
    if (!invitee) return sendError(res, 404, 'User not found.');

    // Check if already a member
    if (room.members.some((m) => m.user.toString() === inviteeId)) {
      return sendError(res, 409, 'User is already in the room.');
    }

    // Capacity check
    if (room.members.length >= room.maxMembers) {
      return sendError(res, 400, 'Room is at full capacity.');
    }

    // Generate secure invitation token
    const rawToken = generateSecureToken(24);
    const hashedToken = hashToken(rawToken);

    room.invitations.push({
      invitee: inviteeId,
      token: hashedToken,
      expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000), // 24 hours
      status: 'pending',
    });

    await room.save();

    // Emit real-time invitation via Socket.IO
    const io = req.app.get('io');
    if (io) {
      io.to(`user:${inviteeId}`).emit('room:invitation', {
        roomId: room._id,
        roomName: room.name,
        invitedBy: {
          id: req.user._id,
          username: req.user.username,
          displayName: req.user.displayName,
        },
        token: rawToken, // client uses this to join
        expiresAt: room.invitations[room.invitations.length - 1].expiresAt,
      });
    }

    return sendSuccess(res, 200, 'Invitation sent.', { invitationToken: rawToken });
  } catch (error) {
    next(error);
  }
};

// ─── Join room via invitation token ──────────────────────────────────────────

exports.joinRoom = async (req, res, next) => {
  try {
    const { token } = req.body;

    if (!token) return sendError(res, 400, 'Invitation token required.');

    const hashedToken = hashToken(token);

    const room = await Room.findOne({
      'invitations.token': hashedToken,
      'invitations.status': 'pending',
      status: 'active',
    });

    if (!room) return sendError(res, 400, 'Invalid or expired invitation.');

    const invitation = room.invitations.find(
      (inv) => inv.token === hashedToken && inv.status === 'pending'
    );

    if (!invitation) return sendError(res, 400, 'Invitation not found.');

    // Check expiry
    if (invitation.expiresAt < new Date()) {
      invitation.status = 'expired';
      await room.save();
      return sendError(res, 400, 'Invitation has expired.');
    }

    // Check invitee matches current user
    if (!invitation.invitee.equals(req.user._id)) {
      return sendError(res, 403, 'This invitation is not for you.');
    }

    // Capacity check
    if (room.members.length >= room.maxMembers) {
      return sendError(res, 400, 'Room is at full capacity.');
    }

    // Mark invitation accepted and add member
    invitation.status = 'accepted';
    room.members.push({ user: req.user._id });
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`room:${room._id}`).emit('room:memberJoined', {
        userId: req.user._id,
        username: req.user.username,
      });
    }

    return sendSuccess(res, 200, 'Joined room.', { roomId: room._id });
  } catch (error) {
    next(error);
  }
};

// ─── Leave room ───────────────────────────────────────────────────────────────

exports.leaveRoom = async (req, res, next) => {
  try {
    const room = await Room.findById(req.params.id);
    if (!room) return sendError(res, 404, 'Room not found.');

    const isMember = room.members.some((m) => m.user.toString() === req.user._id.toString());
    if (!isMember) return sendError(res, 400, 'You are not in this room.');

    // If owner leaves, end the room
    if (room.owner.toString() === req.user._id.toString()) {
      room.status = 'ended';
      room.endedAt = new Date();
      await room.save();

      const io = req.app.get('io');
      if (io) {
        io.to(`room:${room._id}`).emit('room:ended', { reason: 'Owner left the room.' });
      }

      return sendSuccess(res, 200, 'Room ended.');
    }

    room.members = room.members.filter((m) => m.user.toString() !== req.user._id.toString());
    await room.save();

    const io = req.app.get('io');
    if (io) {
      io.to(`room:${room._id}`).emit('room:memberLeft', {
        userId: req.user._id,
        username: req.user.username,
      });
    }

    return sendSuccess(res, 200, 'Left room.');
  } catch (error) {
    next(error);
  }
};

// ─── Update playback state (owner only) ──────────────────────────────────────

exports.updatePlayback = async (req, res, next) => {
  try {
    const { currentSong, isPlaying, position, songTitle, songArtist, queue } = req.body;

    const room = await Room.findOne({ _id: req.params.id, owner: req.user._id, status: 'active' });
    if (!room) return sendError(res, 403, 'Only the room owner can control playback.');

    room.playbackState = {
      currentSong: currentSong || room.playbackState.currentSong,
      songTitle: songTitle || room.playbackState.songTitle,
      songArtist: songArtist || room.playbackState.songArtist,
      isPlaying: isPlaying !== undefined ? isPlaying : room.playbackState.isPlaying,
      position: position !== undefined ? position : room.playbackState.position,
      queue: queue || room.playbackState.queue,
      updatedAt: new Date(),
    };

    await room.save();

    // Broadcast updated state to all room members
    const io = req.app.get('io');
    if (io) {
      io.to(`room:${room._id}`).emit('room:playbackSync', room.playbackState);
    }

    return sendSuccess(res, 200, 'Playback updated.', room.playbackState);
  } catch (error) {
    next(error);
  }
};
