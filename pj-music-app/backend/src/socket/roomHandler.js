/**
 * Room Socket Handler
 * Manages real-time room events: join, leave, playback control.
 * Only the room owner can emit playback commands.
 */

const Room = require('../models/Room');
const logger = require('../utils/logger');

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const handleRoomEvents = (io, socket) => {
  const userId = socket.user._id.toString();

  // ─── Join a room channel ─────────────────────────────────────────────────
  socket.on('room:join', async ({ roomId }) => {
    try {
      if (!roomId) return socket.emit('error', { message: 'Room ID required.' });

      const room = await Room.findById(roomId);
      if (!room || room.status === 'ended') {
        return socket.emit('error', { message: 'Room not found or has ended.' });
      }

      const isMember = room.members.some((m) => m.user.toString() === userId);
      if (!isMember) {
        return socket.emit('error', { message: 'You are not a member of this room.' });
      }

      // Update socket ID for member
      const member = room.members.find((m) => m.user.toString() === userId);
      if (member) {
        member.socketId = socket.id;
        await room.save();
      }

      socket.join(`room:${roomId}`);

      // Send current playback state immediately so new joiner can sync
      socket.emit('room:sync', room.playbackState);

      // Notify others
      socket.to(`room:${roomId}`).emit('room:memberJoined', {
        userId,
        username: socket.user.username,
        displayName: socket.user.displayName,
      });

      logger.info(`${socket.user.username} joined room: ${roomId}`);
    } catch (err) {
      logger.error(`room:join error: ${err.message}`);
      socket.emit('error', { message: 'Failed to join room.' });
    }
  });

  // ─── Leave room channel ──────────────────────────────────────────────────
  socket.on('room:leave', async ({ roomId }) => {
    socket.leave(`room:${roomId}`);

    socket.to(`room:${roomId}`).emit('room:memberLeft', {
      userId,
      username: socket.user.username,
    });
  });

  // ─── Playback controls (owner only) ────────────────────────────────────
  // Events: room:play, room:pause, room:seek, room:next, room:prev, room:changeSong

  socket.on('room:play', async ({ roomId }) => {
    await handlePlaybackControl(io, socket, roomId, { isPlaying: true });
  });

  socket.on('room:pause', async ({ roomId }) => {
    await handlePlaybackControl(io, socket, roomId, { isPlaying: false });
  });

  socket.on('room:seek', async ({ roomId, position }) => {
    if (typeof position !== 'number' || position < 0) return;
    await handlePlaybackControl(io, socket, roomId, { position });
  });

  socket.on('room:changeSong', async ({ roomId, songId, songTitle, songArtist, position = 0 }) => {
    await handlePlaybackControl(io, socket, roomId, {
      currentSong: songId,
      songTitle,
      songArtist,
      position,
      isPlaying: true,
    });
  });

  socket.on('room:next', async ({ roomId }) => {
    try {
      const room = await Room.findById(roomId);
      if (!room || !room.owner.equals(userId)) return;

      // Advance queue
      const queue = room.playbackState.queue || [];
      if (queue.length === 0) return;

      const nextSong = queue.shift();
      room.playbackState.queue = queue;
      room.playbackState.currentSong = nextSong;
      room.playbackState.position = 0;
      room.playbackState.isPlaying = true;
      room.playbackState.updatedAt = new Date();
      await room.save();

      io.to(`room:${roomId}`).emit('room:playbackSync', room.playbackState);
    } catch (err) {
      logger.error(`room:next error: ${err.message}`);
    }
  });
};

/**
 * Helper: verify ownership then update + broadcast playback state.
 */
const handlePlaybackControl = async (io, socket, roomId, updates) => {
  try {
    const room = await Room.findOne({ _id: roomId, status: 'active' });
    if (!room) return socket.emit('error', { message: 'Room not found.' });

    if (!room.owner.equals(socket.user._id)) {
      return socket.emit('error', { message: 'Only the room owner can control playback.' });
    }

    Object.assign(room.playbackState, updates, { updatedAt: new Date() });
    await room.save();

    // Broadcast to all room members
    io.to(`room:${roomId}`).emit('room:playbackSync', room.playbackState);
  } catch (err) {
    logger.error(`Playback control error: ${err.message}`);
    socket.emit('error', { message: 'Playback update failed.' });
  }
};

module.exports = { handleRoomEvents };
