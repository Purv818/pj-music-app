/**
 * Rooms Page
 * Create and join synchronized listening rooms.
 */

import api from '../api.js';
import { escapeHTML, toast } from '../ui.js';
import { emit, on } from '../socket.js';
import { player } from '../player.js';

let activeRoomId = null;

export const renderRooms = async (container) => {
  container.innerHTML = `
    <div class="page page-enter" id="rooms-page">
      <div class="section-header">
        <h2 class="section-title">Listening Rooms</h2>
        <button class="btn btn-sm btn-primary" id="create-room-btn">+ Create</button>
      </div>
      <div id="rooms-list">
        <div class="skeleton" style="height:80px;margin-bottom:8px;border-radius:12px;"></div>
        <div class="skeleton" style="height:80px;border-radius:12px;"></div>
      </div>
    </div>`;

  document.getElementById('create-room-btn')?.addEventListener('click', showCreateRoomModal);

  // Real-time room events
  on('room:playbackSync', (state) => {
    if (activeRoomId) player.syncApply(state);
  });

  on('room:ended', ({ reason }) => {
    toast(reason || 'Room ended', 'info');
    activeRoomId = null;
    loadRooms();
  });

  on('room:memberJoined', ({ username }) => toast(`${username} joined the room`, 'info'));
  on('room:memberLeft', ({ username }) => toast(`${username} left the room`, 'info'));

  await loadRooms();
};

const loadRooms = async () => {
  const list = document.getElementById('rooms-list');
  if (!list) return;

  try {
    const res = await api.get('/rooms');
    const rooms = res.data || [];

    if (rooms.length === 0) {
      list.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <path d="M3 9l9-7 9 7v11a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2z"/>
          </svg>
          <p class="empty-state__title">No rooms yet</p>
          <p class="empty-state__subtitle">Create a room and invite friends to listen together.</p>
        </div>`;
      return;
    }

    list.innerHTML = rooms.map((room) => `
      <div class="room-card" data-room-id="${escapeHTML(room._id)}">
        <div class="room-card__header">
          <span class="room-card__name">${escapeHTML(room.name)}</span>
          <span class="badge ${room.status === 'active' ? 'badge-success' : 'badge-primary'}">${room.status}</span>
        </div>
        <div class="room-card__meta">
          Host: ${escapeHTML(room.owner?.displayName || room.owner?.username || 'Unknown')} · 
          ${room.members?.length || 1} member(s)
        </div>
        ${room.playbackState?.songTitle
          ? `<div class="room-card__now-playing">🎵 ${escapeHTML(room.playbackState.songTitle)}</div>`
          : ''}
      </div>
    `).join('');

    list.querySelectorAll('.room-card').forEach((card) => {
      card.addEventListener('click', () => openRoom(card.dataset.roomId));
    });

  } catch {
    list.innerHTML = '<p class="text-muted text-center" style="padding:32px;">Could not load rooms.</p>';
  }
};

const openRoom = async (roomId) => {
  try {
    const res = await api.get(`/rooms/${roomId}`);
    const room = res.data;
    renderRoomDetail(room);
  } catch (err) {
    toast(err.message || 'Could not open room', 'error');
  }
};

const renderRoomDetail = (room) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:16px;">
        <h2>${escapeHTML(room.name)}</h2>
        <button class="btn btn-sm btn-danger" id="leave-room-btn">Leave</button>
      </div>

      <p style="font-size:0.875rem;color:var(--text-secondary);margin-bottom:12px;">
        ${room.members?.length || 1} / ${room.maxMembers} members
      </p>

      <!-- Members -->
      <div style="margin-bottom:16px;">
        ${(room.members || []).map((m) => `
          <div class="friend-row">
            <div class="avatar avatar-sm">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
                <circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
              </svg>
            </div>
            <span>${escapeHTML(m.user?.displayName || m.user?.username || 'Unknown')}</span>
            ${room.owner?._id === m.user?._id ? '<span class="badge badge-primary" style="margin-left:8px;">Host</span>' : ''}
          </div>
        `).join('')}
      </div>

      <!-- Invite -->
      <button class="btn btn-secondary btn-full" id="invite-to-room-btn" style="margin-bottom:12px;">Invite Friend</button>

      <!-- Playback (owner only) -->
      ${room.isOwner ? `
        <div style="border-top:1px solid var(--border-subtle);padding-top:16px;">
          <h3 style="font-size:0.875rem;margin-bottom:12px;">Playback Controls</h3>
          <div style="display:flex;gap:8px;justify-content:center;">
            <button class="icon-btn room-prev" aria-label="Previous">⏮</button>
            <button class="icon-btn room-play" aria-label="Play/Pause">⏯</button>
            <button class="icon-btn room-next" aria-label="Next">⏭</button>
          </div>
        </div>` : ''}
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) { overlay.remove(); } });

  // Join the socket room
  activeRoomId = room._id;
  emit('room:join', { roomId: room._id });

  document.getElementById('leave-room-btn')?.addEventListener('click', async () => {
    try {
      await api.post(`/rooms/${room._id}/leave`);
      emit('room:leave', { roomId: room._id });
      activeRoomId = null;
      overlay.remove();
      loadRooms();
    } catch (err) { toast(err.message, 'error'); }
  });

  document.getElementById('invite-to-room-btn')?.addEventListener('click', () => {
    showInviteModal(room._id);
    overlay.remove();
  });

  // Owner playback controls
  document.querySelector('.room-play')?.addEventListener('click', () => {
    emit('room:play', { roomId: room._id });
    player.toggle();
  });
  document.querySelector('.room-prev')?.addEventListener('click', () => {
    emit('room:prev', { roomId: room._id });
    player.prev();
  });
  document.querySelector('.room-next')?.addEventListener('click', () => {
    emit('room:next', { roomId: room._id });
    player.next();
  });

  // Setup player sync callback (owner pushes state to room)
  if (room.owner?._id) {
    player.setSyncCallback((state) => {
      emit('sync:update', { sessionId: room._id, state });
    });
  }
};

const showCreateRoomModal = () => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h2 style="margin-bottom:16px;">Create Room</h2>
      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">Room Name</label>
        <input class="form-input" type="text" id="room-name-input" placeholder="My Listening Room" maxlength="80" />
      </div>
      <div class="form-group" style="margin-bottom:16px;">
        <label class="form-label">Max Members</label>
        <input class="form-input" type="number" id="room-max-input" value="10" min="2" max="50" />
      </div>
      <button class="btn btn-primary btn-full" id="create-room-confirm">Create Room</button>
      <button class="btn btn-secondary btn-full" id="cancel-room-btn" style="margin-top:8px;">Cancel</button>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });
  document.getElementById('cancel-room-btn')?.addEventListener('click', () => overlay.remove());

  document.getElementById('create-room-confirm')?.addEventListener('click', async () => {
    const name = document.getElementById('room-name-input')?.value.trim();
    const maxMembers = parseInt(document.getElementById('room-max-input')?.value) || 10;

    if (!name) { toast('Room name is required', 'error'); return; }

    try {
      await api.post('/rooms', { name, maxMembers });
      toast('Room created!', 'success');
      overlay.remove();
      loadRooms();
    } catch (err) {
      toast(err.message || 'Could not create room', 'error');
    }
  });
};

const showInviteModal = async (roomId) => {
  const overlay = document.createElement('div');
  overlay.className = 'modal-overlay';
  overlay.innerHTML = `
    <div class="modal-sheet">
      <div class="modal-handle"></div>
      <h2 style="margin-bottom:16px;">Invite Friend</h2>
      <div id="invite-friends-list">Loading friends...</div>
    </div>`;

  document.body.appendChild(overlay);
  overlay.addEventListener('click', (e) => { if (e.target === overlay) overlay.remove(); });

  try {
    const res = await api.get('/friends');
    const friends = res.data || [];
    const listEl = document.getElementById('invite-friends-list');

    listEl.innerHTML = friends.map((f) => `
      <div class="friend-row">
        <div class="avatar avatar-md">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <circle cx="12" cy="7" r="4"/><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/>
          </svg>
        </div>
        <div class="friend-row__info">
          <div class="friend-row__name">${escapeHTML(f.displayName || f.username)}</div>
        </div>
        <button class="btn btn-sm btn-primary invite-friend-btn" data-id="${escapeHTML(f._id)}">Invite</button>
      </div>
    `).join('');

    listEl.querySelectorAll('.invite-friend-btn').forEach((btn) => {
      btn.addEventListener('click', async () => {
        try {
          await api.post(`/rooms/${roomId}/invite`, { inviteeId: btn.dataset.id });
          btn.textContent = 'Invited!';
          btn.disabled = true;
          toast('Invitation sent!', 'success');
        } catch (err) {
          toast(err.message || 'Could not send invite', 'error');
        }
      });
    });
  } catch {
    document.getElementById('invite-friends-list').innerHTML = '<p class="text-muted">Could not load friends.</p>';
  }
};
