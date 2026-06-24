/**
 * Search Page
 * Real-time search across songs by title, artist, album, genre.
 */

import api from '../api.js';
import { player } from '../player.js';
import { artworkHTML, escapeHTML, formatTime, debounce } from '../ui.js';

export const renderSearch = (container) => {
  container.innerHTML = `
    <div class="page page-enter" id="search-page">
      <h2 class="section-title" style="margin-bottom:16px;">Search</h2>
      <div class="search-input-wrap">
        <div class="search-input-icon">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><line x1="21" y1="21" x2="16.65" y2="16.65"/>
          </svg>
        </div>
        <input class="search-input" id="main-search-input" placeholder="Songs, artists, albums..." type="search"
          inputmode="search" autocomplete="off" autofocus />
        <button class="icon-btn search-clear hidden" id="search-clear-btn" aria-label="Clear search">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" style="width:16px;height:16px;">
            <line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/>
          </svg>
        </button>
      </div>
      <div id="search-results"></div>
    </div>`;

  const input = document.getElementById('main-search-input');
  const clearBtn = document.getElementById('search-clear-btn');
  const resultsEl = document.getElementById('search-results');

  const doSearch = debounce(async (q) => {
    if (!q || q.trim().length === 0) {
      resultsEl.innerHTML = '';
      return;
    }

    resultsEl.innerHTML = `
      <div class="skeleton" style="height:60px;margin-bottom:8px;border-radius:12px;"></div>
      <div class="skeleton" style="height:60px;border-radius:12px;"></div>`;

    try {
      const res = await api.get(`/songs/search?q=${encodeURIComponent(q.trim())}`);
      const songs = res.data || [];

      if (songs.length === 0) {
        resultsEl.innerHTML = `
          <div class="empty-state">
            <p class="empty-state__title">No results for "${escapeHTML(q)}"</p>
            <p class="empty-state__subtitle">Try a different song, artist, or album name.</p>
          </div>`;
        return;
      }

      resultsEl.innerHTML = `
        <p style="font-size:0.75rem;color:var(--text-muted);margin-bottom:8px;">${songs.length} result(s)</p>
        ${songs.map((song, i) => `
          <div class="song-row" data-index="${i}" role="button" tabindex="0">
            <div class="song-row__artwork">${artworkHTML(song.artwork)}</div>
            <div class="song-row__info">
              <div class="song-row__title">${escapeHTML(song.title)}</div>
              <div class="song-row__meta">${escapeHTML(song.artist)} · ${escapeHTML(song.album)}</div>
            </div>
            <span style="font-size:0.75rem;color:var(--text-muted);flex-shrink:0;">${formatTime(song.duration)}</span>
          </div>
        `).join('')}`;

      resultsEl.querySelectorAll('.song-row').forEach((row) => {
        row.addEventListener('click', () => {
          const idx = parseInt(row.dataset.index);
          player.playQueue(songs, idx);
        });
      });

    } catch (err) {
      resultsEl.innerHTML = `<p class="text-muted text-center" style="padding:32px;">${escapeHTML(err.message || 'Search failed')}</p>`;
    }
  }, 350);

  input?.addEventListener('input', () => {
    const q = input.value;
    clearBtn?.classList.toggle('hidden', !q);
    doSearch(q);
  });

  clearBtn?.addEventListener('click', () => {
    if (input) input.value = '';
    clearBtn.classList.add('hidden');
    resultsEl.innerHTML = '';
    input?.focus();
  });
};
