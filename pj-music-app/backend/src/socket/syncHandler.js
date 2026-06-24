/**
 * Sync Handler
 * Peer-to-peer synchronized listening (outside of rooms).
 * User A invites User B; when accepted, their players stay in sync.
 * Uses a "session" concept stored in memory for simplicity.
 * For production scale, use Redis for shared session state.
 */

const logger = require('../utils/logger');

// In-memory sync sessions: Map<sessionId, SyncSession>
// sessionId = "sync:<userId1>:<userId2>" (sorted)
const activeSyncSessions = new Map();

/**
 * @param {import('socket.io').Server} io
 * @param {import('socket.io').Socket} socket
 */
const handleSyncEvents = (io, socket) => {
  const userId = socket.user._id.toString();

  // ─── Send a sync invitation ──────────────────────────────────────────────
  socket.on('sync:invite', ({ targetUserId }) => {
    if (!targetUserId || targetUserId === userId) return;

    logger.info(`Sync invite: ${userId} → ${targetUserId}`);

    // Deliver invitation to target user's personal room
    io.to(`user:${targetUserId}`).emit('sync:inviteReceived', {
      from: {
        id: userId,
        username: socket.user.username,
        displayName: socket.user.displayName,
        avatar: socket.user.avatar,
      },
    });
  });

  // ─── Accept sync invitation ──────────────────────────────────────────────
  socket.on('sync:accept', ({ inviterId }) => {
    if (!inviterId) return;

    const sessionId = buildSessionId(userId, inviterId);

    // Create session room
    socket.join(`sync:${sessionId}`);

    activeSyncSessions.set(sessionId, {
      users: [userId, inviterId],
      createdAt: Date.now(),
      playbackState: {
        isPlaying: false,
        position: 0,
        songId: null,
        songTitle: '',
        songArtist: '',
        updatedAt: Date.now(),
      },
    });

    // Notify inviter that their invite was accepted
    io.to(`user:${inviterId}`).emit('sync:accepted', {
      by: {
        id: userId,
        username: socket.user.username,
      },
      sessionId,
    });

    logger.info(`Sync session created: ${sessionId}`);
  });

  // ─── Decline sync invitation ─────────────────────────────────────────────
  socket.on('sync:decline', ({ inviterId }) => {
    if (!inviterId) return;

    io.to(`user:${inviterId}`).emit('sync:declined', {
      by: {
        id: userId,
        username: socket.user.username,
      },
    });
  });

  // ─── Inviter joins their session room after acceptance ───────────────────
  socket.on('sync:joinSession', ({ sessionId }) => {
    if (!sessionId) return;

    const session = activeSyncSessions.get(sessionId);
    if (!session || !session.users.includes(userId)) {
      return socket.emit('error', { message: 'Sync session not found.' });
    }

    socket.join(`sync:${sessionId}`);

    // Send current state
    socket.emit('sync:stateSync', session.playbackState);
  });

  // ─── Sync playback state (either user can send, both receive) ────────────
  socket.on('sync:update', ({ sessionId, state }) => {
    const session = activeSyncSessions.get(sessionId);
    if (!session || !session.users.includes(userId)) return;

    // Update session state
    session.playbackState = { ...state, updatedAt: Date.now() };
    activeSyncSessions.set(sessionId, session);

    // Broadcast to other user in the session (not back to sender)
    socket.to(`sync:${sessionId}`).emit('sync:stateSync', session.playbackState);
  });

  // ─── End sync session ────────────────────────────────────────────────────
  socket.on('sync:end', ({ sessionId }) => {
    const session = activeSyncSessions.get(sessionId);
    if (!session || !session.users.includes(userId)) return;

    io.to(`sync:${sessionId}`).emit('sync:ended', {
      by: { id: userId, username: socket.user.username },
    });

    activeSyncSessions.delete(sessionId);
    socket.leave(`sync:${sessionId}`);

    logger.info(`Sync session ended: ${sessionId}`);
  });

  // ─── Clean up on disconnect ──────────────────────────────────────────────
  socket.on('disconnect', () => {
    // Notify all sync sessions this user was in
    for (const [sessionId, session] of activeSyncSessions.entries()) {
      if (session.users.includes(userId)) {
        socket.to(`sync:${sessionId}`).emit('sync:peerDisconnected', {
          userId,
          username: socket.user.username,
        });
        activeSyncSessions.delete(sessionId);
      }
    }
  });
};

/**
 * Build a deterministic session ID from two user IDs.
 * Always the same regardless of who initiates.
 */
const buildSessionId = (id1, id2) => {
  return [id1, id2].sort().join(':');
};

module.exports = { handleSyncEvents };
