/**
 * Home Page — PJ Music
 * Greeting, stats, quick actions, recently imported songs
 */

import api from '../api.js';
import { artworkHTML, escapeHTML, formatTime } from '../ui.js';
import { player } from '../player.js';
import { getUser } from '../auth.js';

export const renderHome = async (container) => {
  const user = getUser();
  const hour = new Date().getHours();
  const greeting =
    hour < 5  ? 'Good night'      :
    hour < 12 ? 'Good morning'    :
    hour < 17 ? 'Good afternoon'  :
                'Good evening';

  const name = user?.displayName || user?.username || 'Music Lover';

  // Device songs count
  const deviceCount = (window._deviceSongs || []).length;

  container.innerHTML = `
    <div class="page page-enter" id="home-page" style="padding-bottom:120px;">

      <!-- ── Greeting ──────────────────────────────────────── -->
      <div style="
        padding: 8px 0 24px;
        display:flex;align-items:center;gap:16px;
      ">
        <div style="
          width:52px;height:52px;flex-shrink:0;
          background:linear-gradient(135deg,var(--color-primary),var(--color-accent));
          border-radius:var(--radius-full);
          display:flex;align-items:center;justify-content:center;
          font-size:24px;
          box-shadow:var(--shadow-glow);
        ">🎵</div>
        <div>
          <h1 style="font-size:1.25rem;font-weight:700;color:var(--text-primary);line-height:1.2;">
            ${greeting}, ${escapeHTML(name)}!
          </h1>
          <p style="font-size:0.8rem;color:var(--text-muted);margin-top:2px;">
            ${deviceCount > 0 ? `${deviceCount} songs ready to play` : 'Import karo songs sunne ke liye'}
          </p>
        </div>
      </div>

      <!-- ── Quick Actions ─────────────────────────────────── -->
      <div style="margin-bottom:28px;">
        <h2 style="font-size:0.75rem;font-weight:700;color:var(--text-muted);
          text-transform:uppercase;letter-spacing:0.8px;margin-bottom:12px;">
          Quick Actions
        </h2>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:10px;">

          <!-- Import Music -->
          <div id="qa-import" style="
            background:linear-gradient(135deg,rgba(6,182,212,0.15),rgba(59,130,246,0.15));
            border:1px solid rgba(6,182,212,0.3);
            border-radius:var(--radius-lg);
            padding:16px;cursor:pointer;
            transition:transform 0.15s,box-shadow 0.15s;
            display:flex;flex-direction:column;gap:10px;
          " onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">
            <div style="
              width:40px;height:40px;
              background:linear-gradient(135deg,#06b6d4,#3b82f6);
              border-radius:10px;display:flex;align-items:center;justify-content:center;
              font-size:20px;
            ">📂</div>
            <div>
              <div style="font-weight:700;font-size:0.875rem;color:var(--text-primary);">Import Music</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Device se songs add karo</div>
            </div>
          </div>

          <!-- Liked Songs -->
          <div id="qa-liked" style="
            background:linear-gradient(135deg,rgba(236,72,153,0.15),rgba(168,85,247,0.15));
            border:1px solid rgba(168,85,247,0.3);
            border-radius:var(--radius-lg);
            padding:16px;cursor:pointer;
            transition:transform 0.15s;
            display:flex;flex-direction:column;gap:10px;
          " onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">
            <div style="
              width:40px;height:40px;
              background:linear-gradient(135deg,#ec4899,#a855f7);
              border-radius:10px;display:flex;align-items:center;justify-content:center;
              font-size:20px;
            ">❤️</div>
            <div>
              <div style="font-weight:700;font-size:0.875rem;color:var(--text-primary);">Liked Songs</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Favorite tracks</div>
            </div>
          </div>

          <!-- Playlists -->
          <div id="qa-playlists" style="
            background:linear-gradient(135deg,rgba(245,158,11,0.15),rgba(239,68,68,0.15));
            border:1px solid rgba(245,158,11,0.3);
            border-radius:var(--radius-lg);
            padding:16px;cursor:pointer;
            transition:transform 0.15s;
            display:flex;flex-direction:column;gap:10px;
          " onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">
            <div style="
              width:40px;height:40px;
              background:linear-gradient(135deg,#f59e0b,#ef4444);
              border-radius:10px;display:flex;align-items:center;justify-content:center;
              font-size:20px;
            ">📋</div>
            <div>
              <div style="font-weight:700;font-size:0.875rem;color:var(--text-primary);">Playlists</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Apni list banao</div>
            </div>
          </div>

          <!-- Listen Together -->
          <div id="qa-rooms" style="
            background:linear-gradient(135deg,rgba(16,185,129,0.15),rgba(6,182,212,0.15));
            border:1px solid rgba(16,185,129,0.3);
            border-radius:var(--radius-lg);
            padding:16px;cursor:pointer;
            transition:transform 0.15s;
            display:flex;flex-direction:column;gap:10px;
          " onmousedown="this.style.transform='scale(0.97)'" onmouseup="this.style.transform='scale(1)'">
            <div style="
              width:40px;height:40px;
              background:linear-gradient(135deg,#10b981,#06b6d4);
              border-radius:10px;display:flex;align-items:center;justify-content:center;
              font-size:20px;
            ">🎧</div>
            <div>
              <div style="font-weight:700;font-size:0.875rem;color:var(--text-primary);">Listen Together</div>
              <div style="font-size:0.7rem;color:var(--text-muted);margin-top:2px;">Dosto ke saath suno</div>
            </div>
          </div>

        </div>
      </div>

      <!-- ── Songs Section ──────────────────────────────────── -->
      <div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:12px;">
          <h2 style="font-size:0.75rem;font-weight:700;color:var(--text-muted);
            text-transform:uppercase;letter-spacing:0.8px;">
            ${deviceCount > 0 ? 'Your Songs' : 'Songs'}
          </h2>
          ${deviceCount > 0 ? `<span style="font-size:0.75rem;color:var(--color-primary);font-weight:600;">${deviceCount} songs</span>` : ''}
        </div>
        <div id="home-songs-list"></div>
      </div>

    </div>`;

  // ── Event listeners ──────────────────────────────────────────
  document.getElementById('qa-import')?.addEventListener('click', () => {
    window.dispatchEvent(new CustomEvent('app:importMusic'));
    // Switch to library tab
    setTimeout(() => document.querySelector('[data-page="library"]')?.click(), 100);
  });

  document.getElementById('qa-liked')?.addEventListener('click', () => {
    document.querySelector('[data-page="library"]')?.click();
  });

  document.getElementById('qa-playlists')?.addEventListener('click', () => {
    document.querySelector('[data-page="library"]')?.click();
  });

  document.getElementById('qa-rooms')?.addEventListener('click', () => {
    document.querySelector('[data-page="rooms"]')?.click();
  });

  // ── Load songs ───────────────────────────────────────────────
  renderHomeSongs();
};

const renderHomeSongs = () => {
  const container = document.getElementById('home-songs-list');
  if (!container) return;

  // Device songs (imported) + mock songs merged
  const deviceSongs = window._deviceSongs || [];

  if (deviceSongs.length === 0) {
    container.innerHTML = `
      <div style="
        background:var(--bg-card);
        border:1.5px dashed var(--border-color);
        border-radius:var(--radius-lg);
        padding:32px 20px;
        text-align:center;
      ">
        <div style="font-size:48px;margin-bottom:12px;">🎵</div>
        <p style="font-weight:700;color:var(--text-primary);font-size:1rem;margin-bottom:6px;">
          Koi songs nahi hain abhi
        </p>
        <p style="color:var(--text-muted);font-size:0.8rem;line-height:1.6;margin-bottom:16px;">
          "Import Music" dabao aur apne phone ke<br>MP3, FLAC ya AAC songs add karo
        </p>
        <button id="home-import-btn" class="btn btn-primary" style="padding:10px 24px;">
          📂 Import Music
        </button>
      </div>`;

    document.getElementById('home-import-btn')?.addEventListener('click', () => {
      window.dispatchEvent(new CustomEvent('app:importMusic'));
      setTimeout(() => document.querySelector('[data-page="library"]')?.click(), 100);
    });
    return;
  }

  // Show songs
  const displaySongs = deviceSongs.slice(0, 20);

  container.innerHTML = displaySongs.map((song, i) => `
    <div class="song-row" data-index="${i}" data-song-id="${escapeHTML(String(song._id || i))}"
      role="button" tabindex="0" style="margin-bottom:2px;">
      <div class="song-row__artwork" style="
        width:46px;height:46px;border-radius:10px;
        background:linear-gradient(135deg,var(--bg-elevated),var(--bg-card));
        display:flex;align-items:center;justify-content:center;
        flex-shrink:0;overflow:hidden;
      ">
        ${song.artwork
          ? `<img src="${song.artwork.startsWith('data:') ? song.artwork : `data:image/jpeg;base64,${song.artwork}`}"
              style="width:100%;height:100%;object-fit:cover;" alt="" />`
          : `<span style="font-size:20px;">🎵</span>`
        }
      </div>
      <div class="song-row__info" style="flex:1;min-width:0;">
        <div style="
          font-weight:600;font-size:0.875rem;
          color:var(--text-primary);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;
        ">${escapeHTML(song.title || 'Unknown')}</div>
        <div style="
          font-size:0.75rem;color:var(--text-muted);
          white-space:nowrap;overflow:hidden;text-overflow:ellipsis;margin-top:1px;
        ">${escapeHTML(song.artist || 'Unknown Artist')}${song.duration ? ' · ' + formatTime(song.duration) : ''}</div>
      </div>
      <button style="
        flex-shrink:0;width:32px;height:32px;
        background:rgba(168,85,247,0.15);
        border-radius:50%;
        display:flex;align-items:center;justify-content:center;
        font-size:14px;
        border:none;cursor:pointer;
      ">▶</button>
    </div>
  `).join('');

  // Click to play
  container.querySelectorAll('.song-row').forEach(row => {
    row.addEventListener('click', () => {
      const idx = parseInt(row.dataset.index);
      player.playQueue(deviceSongs, idx);
    });
  });

  // Show "View all" if more than 20
  if (deviceSongs.length > 20) {
    const more = document.createElement('button');
    more.className = 'btn btn-secondary btn-full';
    more.style.marginTop = '12px';
    more.textContent = `Sab dekho (${deviceSongs.length} songs)`;
    more.addEventListener('click', () => document.querySelector('[data-page="library"]')?.click());
    container.appendChild(more);
  }
};

/**
 * Home page songs refresh karo (baad mein call ho sakta hai jab songs load hon)
 */
export const refreshHomeSongs = () => {
  if (document.getElementById('home-songs-list')) {
    renderHomeSongs();
  }
};
