/**
 * Library Page
 * Tabs: All Songs | Playlists | Favorites | Albums | Artists
 */

import api from '../api.js';
import { player } from '../player.js';
import { artworkHTML, escapeHTML, formatTime, toast } from '../ui.js';
import { scanFromFilePicker, syncSongsToServer, getPlaybackUrl } from '../scanner.js';

let localSongs = []; // Songs loaded from server (metadata) + local files
let localFiles = {}; // Map: songId/filePath → File object for local playback

export const renderLibrary = async (container) => {
  container.innerHTML = `
    <div class="page page-enter" id="library-page">
      <div class="section-header">
        <h2 class="section-title">My Library</h2>
        <button class="btn btn-sm btn-secondary" id="import-btn">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <line x1="12" y1="5" x2="12" y2="19"/><polyline points="19 12 12 19 5 12"/>
          </svg>
          Import
        </button>
      </div>

      <div class="library-tabs" role="tablist" id="library-tabs">
        <button class="chip active" role="tab" data-tab="songs" aria-selected="true">Songs</button>
        <button class="chip" role="tab" data-tab="playlists" aria-selected="false">Playlists</button>
        <button class="chip" role="tab" data-tab="favorites" aria-selected="false">Favorites</button>
        <button class="chip" role="tab" data-tab="albums" aria-selected="false">Albums</button>
        <button class="chip" role="tab" data-tab="artists" aria-selected="false">Artists</button>
      </div>

      <div id="library-content">
        <div class="skeleton" style="height:64px;margin-bottom:8px;border-radius:12px;"></div>
        <div class="skeleton" style="height:64px;margin-bottom:8px;border-radius:12px;"></div>
        <div class="skeleton" style="height:64px;border-radius:12px;"></div>
      </div>
    </div>`;

  // Import button
  document.getElementById('import-btn')?.addEventListener('click', importMusic);

  // Listen for global import event (from home page)
  const importHandler = () => importMusic();
  window.addEventListener('app:importMusic', importHandler, { once: true });

  // Tab switching
  document.getElementById('library-tabs')?.addEventListener('click', (e) => {
    const tab = e.target.closest('[data-tab]');
    if (!tab) return;

    document.querySelectorAll('#library-tabs .chip').forEach((c) => {
      c.classList.remove('active');
      c.setAttribute('aria-selected', 'false');
    });
    tab.classList.add('active');
    tab.setAttribute('aria-selected', 'true');

    loadTab(tab.dataset.tab);
  });

  // Load default tab
  await loadSongs();
};

const loadTab = async (tab) => {
  switch (tab) {
    case 'songs':      return loadSongs();
    case 'playlists':  return loadPlaylists();
    case 'favorites':  return loadFavorites();
    case 'albums':     return loadGrouped('album');
    case 'artists':    return loadGrouped('artist');
  }
};

// ─── Songs ────────────────────────────────────────────────────────────────────

const loadSongs = async () => {
  const content = document.getElementById('library-content');

  try {
    const res = await api.get('/songs?sortBy=title&limit=500');
    const serverSongs = res.data?.songs || [];

    // window._deviceSongs — auto-scan ya import se aaye songs
    const deviceSongs = (window._deviceSongs || []).map(s => ({
      ...s,
      _id:       s._id || ('device_' + Math.random().toString(36).slice(2)),
      _isDevice: true,
    }));

    // Merge: server songs + device songs (duplicates hatao by title+artist)
    const merged = [...serverSongs];
    deviceSongs.forEach(ds => {
      const isDup = merged.some(
        s => s.title?.toLowerCase() === ds.title?.toLowerCase()
          && s.artist?.toLowerCase() === ds.artist?.toLowerCase()
      );
      if (!isDup) merged.push(ds);
    });

    localSongs = merged;
    renderSongList(localSongs, 'library-content');

  } catch (err) {
    console.error('[Library] loadSongs error:', err);
    if (content) content.innerHTML =
      '<p class="text-muted text-center" style="padding:32px;">Songs load nahi ho sake.</p>';
  }
};

const renderSongList = (songs, containerId, queue = null) => {
  const container = document.getElementById(containerId);
  if (!container) return;

  if (songs.length === 0) {
    container.innerHTML = `
      <div class="empty-state">
        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
          <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
        </svg>
        <p class="empty-state__title">No songs found</p>
        <p class="empty-state__subtitle">Import music from your device to get started.</p>
      </div>`;
    return;
  }

  const playQueue = queue || songs;

  container.innerHTML = songs.map((song, i) => `
    <div class="song-row" data-index="${i}" role="button" tabindex="0" aria-label="Play ${escapeHTML(song.title)}">
      <div class="song-row__artwork">${artworkHTML(song.artwork)}</div>
      <div class="song-row__info">
        <div class="song-row__title">${escapeHTML(song.title)}</div>
        <div class="song-row__meta">
          ${escapeHTML(song.artist)}
          ${song.duration ? ' · ' + formatTime(song.duration) : ''}
          ${song._isDevice ? ' · <span style="color:var(--color-primary);font-size:0.7rem;">📱 Device</span>' : ''}
        </div>
      </div>
      <div class="song-row__actions">
        <button class="icon-btn more-btn" data-song-id="${escapeHTML(String(song._id))}" aria-label="More options">
          <svg viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5"/><circle cx="12" cy="12" r="1.5"/><circle cx="12" cy="19" r="1.5"/>
          </svg>
        </button>
      </div>
    </div>
  `).join('');

  container.querySelectorAll('.song-row').forEach((row) => {
    row.addEventListener('click', (e) => {
      if (e.target.closest('.more-btn')) return;
      const idx = parseInt(row.dataset.index);
      player.playQueue(playQueue, idx);
    });
  });
};

// ─── Playlists ────────────────────────────────────────────────────────────────

const loadPlaylists = async () => {
  const content = document.getElementById('library-content');
  try {
    const res = await api.get('/playlists');
    const playlists = res.data || [];

    if (playlists.length === 0) {
      content.innerHTML = `
        <div class="empty-state">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5">
            <line x1="8" y1="6" x2="21" y2="6"/><line x1="8" y1="12" x2="21" y2="12"/>
            <line x1="8" y1="18" x2="21" y2="18"/>
          </svg>
          <p class="empty-state__title">No playlists</p>
          <button class="btn btn-primary btn-sm" id="create-playlist-btn" style="margin-top:8px;">Create Playlist</button>
        </div>`;
      document.getElementById('create-playlist-btn')?.addEventListener('click', showCreatePlaylistModal);
      return;
    }

    content.innerHTML = `
      <button class="btn btn-secondary btn-full" id="create-playlist-btn" style="margin-bottom:16px;">
        + New Playlist
      </button>
      ${playlists.map((pl) => `
        <div class="song-row" data-id="${escapeHTML(pl._id)}" role="button" tabindex="0">
          <div class="song-row__artwork">
            ${artworkHTML(pl.artwork, pl.name)}
          </div>
          <div class="song-row__info">
            <div class="song-row__title">${escapeHTML(pl.name)}</div>
            <div class="song-row__meta">${pl.songCount || 0} songs</div>
          </div>
        </div>
      `).join('')}`;

    document.getElementById('create-playlist-btn')?.addEventListener('click', showCreatePlaylistModal);

  } catch {
    content.innerHTML = '<p class="text-muted text-center" style="padding:32px;">Could not load playlists.</p>';
  }
};

const showCreatePlaylistModal = () => {
  const name = window.prompt('Playlist name:');
  if (!name?.trim()) return;

  api.post('/playlists', { name: name.trim() })
    .then(() => { toast('Playlist created!', 'success'); loadPlaylists(); })
    .catch(() => toast('Could not create playlist.', 'error'));
};

// ─── Favorites ────────────────────────────────────────────────────────────────

const loadFavorites = async () => {
  const content = document.getElementById('library-content');
  try {
    const res = await api.get('/songs/favorites');
    const songs = res.data || [];
    player.setFavorites(songs.map((s) => s._id));
    renderSongList(songs, 'library-content');
  } catch {
    content.innerHTML = '<p class="text-muted text-center" style="padding:32px;">Could not load favorites.</p>';
  }
};

// ─── Grouped (Albums / Artists) ───────────────────────────────────────────────

const loadGrouped = async (groupBy) => {
  const content = document.getElementById('library-content');
  try {
    const res = await api.get('/songs?sortBy=' + groupBy + '&limit=500');
    const songs = res.data?.songs || [];

    // Group
    const groups = {};
    songs.forEach((song) => {
      const key = song[groupBy] || 'Unknown';
      if (!groups[key]) groups[key] = [];
      groups[key].push(song);
    });

    if (Object.keys(groups).length === 0) {
      content.innerHTML = '<p class="text-muted text-center" style="padding:32px;">No content found.</p>';
      return;
    }

    content.innerHTML = Object.entries(groups).map(([name, groupSongs]) => `
      <div class="song-row" data-group="${escapeHTML(name)}" role="button" tabindex="0">
        <div class="song-row__artwork">
          ${artworkHTML(groupSongs[0]?.artwork, name)}
        </div>
        <div class="song-row__info">
          <div class="song-row__title">${escapeHTML(name)}</div>
          <div class="song-row__meta">${groupSongs.length} song${groupSongs.length !== 1 ? 's' : ''}</div>
        </div>
      </div>
    `).join('');

    // Click to play whole group
    content.querySelectorAll('.song-row').forEach((row) => {
      const groupName = row.dataset.group;
      row.addEventListener('click', () => {
        const groupSongs = groups[groupName];
        if (groupSongs) player.playQueue(groupSongs, 0);
      });
    });

  } catch {
    content.innerHTML = '<p class="text-muted text-center" style="padding:32px;">Could not load content.</p>';
  }
};

// ─── Import Music ─────────────────────────────────────────────────────────────

const importMusic = async () => {
  try {
    // Toast dikhao taaki user jaane kuch ho raha hai
    toast('📂 Files choose karo...', 'info', 2000);

    const scanned = await scanFromFilePicker();
    if (scanned.length === 0) return;

    toast(`🎵 ${scanned.length} songs import ho rahe hain...`, 'info', 3000);

    // In-memory map mein store karo taaki player play kar sake
    scanned.forEach((song) => {
      if (song._file || song._blobUrl) {
        localFiles[song._id || song.filePath] = song._file;
      }
    });

    // window._deviceSongs mein merge karo
    const existing = window._deviceSongs || [];
    const merged   = [...existing];

    scanned.forEach(song => {
      const dup = merged.some(
        s => s.title === song.title && s.artist === song.artist
      );
      if (!dup) merged.push(song);
    });

    window._deviceSongs = merged;

    // Server pe sync karo (background mein)
    syncSongsToServer(scanned).catch(() => {});

    // Library refresh karo
    await loadSongs();

    // Home page ko bhi notify karo
    window.dispatchEvent(new CustomEvent('app:songsImported'));

    toast(`✅ ${scanned.length} songs library mein add ho gaye!`, 'success', 3000);

  } catch (err) {
    console.error('[Library] Import error:', err);
    toast('Import fail ho gaya. Dobara try karo.', 'error');
  }
};
