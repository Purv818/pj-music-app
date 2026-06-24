/**
 * PJ Music — Music Player
 * HTML5 Audio + Web Audio Engine (EQ, compressor)
 */

import api from './api.js';
import { formatTime, escapeHTML, toast } from './ui.js';
import { initAudioEngine, resumeAudio, applyPreset, EQ_PRESETS } from './audio-engine.js';

// ─── State ────────────────────────────────────────────────────────────────────
const state = {
  queue:        [],
  currentIndex: -1,
  isPlaying:    false,
  isShuffle:    false,
  repeatMode:   'none',   // 'none' | 'all' | 'one'
  favorites:    new Set(),
  syncCallback: null,
};

const audio = document.getElementById('audio-element');

// ─── Public API ───────────────────────────────────────────────────────────────
export const player = {

  playQueue(songs, startIndex = 0) {
    if (!songs?.length) return;
    state.queue        = [...songs];
    state.currentIndex = Math.max(0, Math.min(startIndex, songs.length - 1));
    loadAndPlay();
  },

  playSong(song) {
    state.queue        = [song];
    state.currentIndex = 0;
    loadAndPlay();
  },

  play()   { resumeAudio(); audio.play().catch(e => console.warn('play():', e)); },
  pause()  { audio.pause(); },
  toggle() { resumeAudio(); state.isPlaying ? audio.pause() : audio.play().catch(() => {}); },

  next() { advanceTrack(1); },

  prev() {
    if (audio.currentTime > 3) { audio.currentTime = 0; }
    else                        { advanceTrack(-1); }
  },

  seek(seconds) {
    if (!isNaN(audio.duration)) {
      audio.currentTime = Math.max(0, Math.min(seconds, audio.duration));
    }
  },

  setVolume(v) { audio.volume = Math.max(0, Math.min(1, v)); },

  setEQPreset(preset) {
    applyPreset(preset);
    toast(`🎵 ${EQ_PRESETS[preset]?.label || preset}`, 'info', 1500);
  },

  toggleShuffle() {
    state.isShuffle = !state.isShuffle;
    document.getElementById('fp-shuffle')?.setAttribute('data-active', state.isShuffle);
    return state.isShuffle;
  },

  cycleRepeat() {
    const modes      = ['none', 'all', 'one'];
    const idx        = modes.indexOf(state.repeatMode);
    state.repeatMode = modes[(idx + 1) % modes.length];
    document.getElementById('fp-repeat')?.setAttribute('data-mode', state.repeatMode);
    return state.repeatMode;
  },

  getCurrentSong()  { return state.queue[state.currentIndex] || null; },

  getState() {
    return {
      isPlaying:   state.isPlaying,
      currentTime: audio.currentTime,
      duration:    audio.duration || 0,
      song:        state.queue[state.currentIndex] || null,
    };
  },

  setSyncCallback(fn)  { state.syncCallback = fn; },
  clearSyncCallback()  { state.syncCallback = null; },

  syncApply({ isPlaying, position }) {
    if (Math.abs(audio.currentTime - (position || 0)) > 1.5) {
      audio.currentTime = position || 0;
    }
    if (isPlaying && audio.paused)  audio.play().catch(() => {});
    if (!isPlaying && !audio.paused) audio.pause();
  },

  setFavorites(ids) {
    state.favorites = new Set(ids.map(String));
    updateFavUI();
  },

  isFavorite(id) { return state.favorites.has(String(id)); },
};

// ─── Core playback ────────────────────────────────────────────────────────────
const loadAndPlay = () => {
  const song = state.queue[state.currentIndex];
  if (!song) return;

  // ── IMPORTANT: remove crossOrigin before setting src ──────────
  // crossOrigin='anonymous' breaks blob: URLs
  audio.removeAttribute('crossorigin');

  const src = song._blobUrl || song.filePath || '';

  if (!src) {
    toast(`⚠️ "${escapeHTML(song.title)}" ka file path nahi mila`, 'error');
    return;
  }

  audio.src = src;
  audio.load();

  // Initialize Web Audio Engine (only after user gesture)
  initAudioEngine(audio);
  resumeAudio();

  audio.play().catch(err => {
    console.error('[Player] play error:', err);
    if (err.name === 'NotSupportedError') {
      toast(`❌ "${song.title}" format support nahi hai`, 'error');
    } else if (err.name === 'NotAllowedError') {
      toast('▶ Play dabao song shuru karne ke liye', 'info');
    } else {
      toast('Song play nahi ho raha — file check karo', 'error');
    }
  });

  if (song._id && !String(song._id).startsWith('local_') && !String(song._id).startsWith('device_')) {
    api.post(`/songs/${song._id}/play`, {}).catch(() => {});
  }

  updatePlayerUI(song);
  updateNowPlayingInList(song._id);
  // Lock screen / notification mein bhi show karo
  setTimeout(updateMediaSession, 300);
};

const advanceTrack = (dir) => {
  const len = state.queue.length;
  if (!len) return;

  if (state.isShuffle) {
    let r;
    do { r = Math.floor(Math.random() * len); }
    while (len > 1 && r === state.currentIndex);
    state.currentIndex = r;
  } else {
    state.currentIndex = (state.currentIndex + dir + len) % len;
  }
  loadAndPlay();
};

// ─── Audio events ─────────────────────────────────────────────────────────────
audio.addEventListener('play',  () => { state.isPlaying = true;  updatePlayUI(true);  emitSync(); updateMediaSession(); });
audio.addEventListener('pause', () => { state.isPlaying = false; updatePlayUI(false); emitSync(); });
audio.addEventListener('timeupdate', updateProgress);
audio.addEventListener('loadedmetadata', updateDuration);

audio.addEventListener('ended', () => {
  if (state.repeatMode === 'one') {
    audio.currentTime = 0;
    audio.play().catch(() => {});
  } else if (state.repeatMode === 'all' || state.currentIndex < state.queue.length - 1) {
    // ✅ Auto next — ek song khatam hone ke baad seedha agla bajta hai
    advanceTrack(1);
  } else {
    // Queue khatam — repeat 'all' mode mein wapas pehle se
    state.isPlaying = false;
    updatePlayUI(false);
  }
});

audio.addEventListener('error', () => {
  const song = state.queue[state.currentIndex];
  console.error('[Player] Audio error. src:', audio.src, 'error:', audio.error?.message);
  // Error pe bhi next song try karo
  if (state.queue.length > 1) {
    setTimeout(() => advanceTrack(1), 500);
  } else {
    toast(`"${song?.title || 'Song'}" play nahi ho raha`, 'error');
  }
});

// ─── Media Session API (background play + lock screen controls) ───────────────
const updateMediaSession = () => {
  if (!('mediaSession' in navigator)) return;
  const song = state.queue[state.currentIndex];
  if (!song) return;

  navigator.mediaSession.metadata = new MediaMetadata({
    title:  song.title  || 'Unknown',
    artist: song.artist || 'Unknown Artist',
    album:  song.album  || 'PJ Music',
    artwork: song.artwork ? [
      { src: song.artwork.startsWith('data:') ? song.artwork : `data:image/jpeg;base64,${song.artwork}`, sizes: '512x512', type: 'image/jpeg' }
    ] : [
      { src: '/icons/icon.svg', sizes: '512x512', type: 'image/svg+xml' }
    ],
  });

  navigator.mediaSession.setActionHandler('play',         () => { player.play(); });
  navigator.mediaSession.setActionHandler('pause',        () => { player.pause(); });
  navigator.mediaSession.setActionHandler('nexttrack',    () => { player.next(); });
  navigator.mediaSession.setActionHandler('previoustrack',() => { player.prev(); });
  navigator.mediaSession.setActionHandler('seekto', (d)  => { if (d.seekTime != null) player.seek(d.seekTime); });

  navigator.mediaSession.playbackState = 'playing';
};

const emitSync = () => {
  if (state.syncCallback) {
    state.syncCallback({
      isPlaying:  state.isPlaying,
      position:   audio.currentTime,
      songId:     state.queue[state.currentIndex]?._id,
      songTitle:  state.queue[state.currentIndex]?.title,
      songArtist: state.queue[state.currentIndex]?.artist,
    });
  }
};

// ─── UI Updates ───────────────────────────────────────────────────────────────
const updatePlayerUI = (song) => {
  if (!song) return;

  const set = (id, text) => { const el = document.getElementById(id); if (el) el.textContent = text || ''; };
  set('mini-title',  song.title);
  set('mini-artist', song.artist);
  set('fp-title',    song.title);
  set('fp-artist',   song.artist);

  document.getElementById('mini-player')?.classList.remove('hidden');

  const miniArt = document.getElementById('mini-artwork');
  if (miniArt) {
    if (song.artwork) {
      miniArt.src = song.artwork.startsWith('data:') ? song.artwork : `data:image/jpeg;base64,${song.artwork}`;
      miniArt.style.display = 'block';
    } else {
      miniArt.style.display = 'none';
    }
  }

  const fpArt   = document.getElementById('fp-artwork');
  const fpArtBg = document.getElementById('fp-artwork-bg');
  if (fpArt) {
    if (song.artwork) {
      const src = song.artwork.startsWith('data:') ? song.artwork : `data:image/jpeg;base64,${song.artwork}`;
      fpArt.src = src;
      if (fpArtBg) fpArtBg.style.backgroundImage = `url(${src})`;
    } else {
      fpArt.src = '';
      if (fpArtBg) fpArtBg.style.backgroundImage = '';
    }
  }

  updateFavUI();
  document.title = `${song.title || 'PJ Music'} — ${song.artist || ''}`;
};

const updateNowPlayingInList = (songId) => {
  // Remove old now-playing class
  document.querySelectorAll('.song-row.now-playing').forEach(r => r.classList.remove('now-playing'));
  // Add to current
  if (songId) {
    document.querySelectorAll(`.song-row[data-song-id="${CSS.escape(String(songId))}"]`)
      .forEach(r => r.classList.add('now-playing'));
  }
};

const PLAY_ICON  = `<path d="M8 5v14l11-7z"/>`;
const PAUSE_ICON = `<rect x="6" y="4" width="4" height="16"/><rect x="14" y="4" width="4" height="16"/>`;

const updatePlayUI = (playing) => {
  const icon = playing ? PAUSE_ICON : PLAY_ICON;
  const m    = document.getElementById('mini-play-icon');
  const f    = document.getElementById('fp-play-icon');
  if (m) m.innerHTML = icon;
  if (f) f.innerHTML = icon;
};

const updateProgress = () => {
  const { currentTime, duration } = audio;
  const pct = duration ? (currentTime / duration) * 100 : 0;
  const bar  = document.getElementById('fp-seek');
  const cur  = document.getElementById('fp-current-time');
  if (bar) bar.value     = pct;
  if (cur) cur.textContent = formatTime(currentTime);
};

const updateDuration = () => {
  const el = document.getElementById('fp-duration');
  if (el) el.textContent = formatTime(audio.duration);
};

const updateFavUI = () => {
  const song = state.queue[state.currentIndex];
  const btn  = document.getElementById('fp-fav');
  if (btn && song?._id) btn.classList.toggle('active', state.favorites.has(String(song._id)));
};

// ─── Controls ─────────────────────────────────────────────────────────────────
export const initPlayerControls = () => {
  // Mini player → open full player
  document.getElementById('mini-player')?.addEventListener('click', (e) => {
    if (!e.target.closest('.mini-player__controls')) {
      document.getElementById('full-player')?.classList.remove('hidden');
    }
  });

  document.getElementById('mini-prev')?.addEventListener('click', (e) => { e.stopPropagation(); player.prev(); });
  document.getElementById('mini-next')?.addEventListener('click', (e) => { e.stopPropagation(); player.next(); });
  document.getElementById('mini-play')?.addEventListener('click', (e) => { e.stopPropagation(); player.toggle(); });

  document.getElementById('close-player')?.addEventListener('click', ()  => document.getElementById('full-player')?.classList.add('hidden'));
  document.getElementById('player-backdrop')?.addEventListener('click', () => document.getElementById('full-player')?.classList.add('hidden'));

  document.getElementById('fp-play')?.addEventListener('click',    () => player.toggle());
  document.getElementById('fp-prev')?.addEventListener('click',    () => player.prev());
  document.getElementById('fp-next')?.addEventListener('click',    () => player.next());
  document.getElementById('fp-shuffle')?.addEventListener('click', () => player.toggleShuffle());
  document.getElementById('fp-repeat')?.addEventListener('click',  () => player.cycleRepeat());

  document.getElementById('fp-seek')?.addEventListener('input', (e) => {
    const pct = parseFloat(e.target.value) / 100;
    if (!isNaN(audio.duration)) audio.currentTime = pct * audio.duration;
  });

  document.getElementById('fp-volume')?.addEventListener('input', (e) => {
    player.setVolume(parseFloat(e.target.value));
  });

  document.getElementById('fp-fav')?.addEventListener('click', async () => {
    const song = player.getCurrentSong();
    if (!song?._id) return;
    try {
      const res = await api.post(`/songs/${song._id}/favorite`, {});
      if (res.data.isFavorite) state.favorites.add(String(song._id));
      else                      state.favorites.delete(String(song._id));
      updateFavUI();
      toast(res.data.isFavorite ? '❤️ Favorites mein add kiya' : 'Favorites se hataya');
    } catch { toast('Favorite update nahi hua', 'error'); }
  });

  document.getElementById('fp-eq-btn')?.addEventListener('click', showEQPanel);
};

// ─── EQ Panel ─────────────────────────────────────────────────────────────────
const showEQPanel = () => {
  import('./audio-engine.js').then(({ EQ_PRESETS, getCurrentPreset, getCurrentBandGains, setEQBand, setBassBoost, applyPreset }) => {
    const currentPreset = getCurrentPreset();
    const currentGains  = getCurrentBandGains();
    const freqLabels    = ['32', '63', '125', '250', '500', '1k', '2k', '4k', '8k', '16k'];

    const overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.innerHTML = `
      <div class="modal-sheet">
        <div class="modal-handle"></div>
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:20px;">
          <div><h2 style="font-size:1.1rem;margin-bottom:2px;">🎛️ Equalizer</h2>
          <p style="font-size:0.75rem;color:var(--text-muted);">Sound quality customize karo</p></div>
          <button id="eq-close" class="icon-btn">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><line x1="18" y1="6" x2="6" y2="18"/><line x1="6" y1="6" x2="18" y2="18"/></svg>
          </button>
        </div>

        <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:8px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Preset</p>
        <div style="display:flex;gap:6px;overflow-x:auto;padding-bottom:8px;scrollbar-width:none;margin-bottom:20px;">
          ${Object.entries(EQ_PRESETS).map(([key, p]) => `
            <button class="preset-btn" data-preset="${key}" style="
              flex-shrink:0;padding:6px 14px;border-radius:99px;font-size:0.78rem;font-weight:600;
              white-space:nowrap;transition:all 0.15s;
              border:1.5px solid ${key === currentPreset ? 'var(--color-primary)' : 'var(--border-color)'};
              background:${key === currentPreset ? 'rgba(168,85,247,0.18)' : 'var(--bg-elevated)'};
              color:${key === currentPreset ? 'var(--color-primary)' : 'var(--text-secondary)'};
            ">${p.label}</button>`).join('')}
        </div>

        <p style="font-size:0.72rem;color:var(--text-muted);margin-bottom:10px;font-weight:600;text-transform:uppercase;letter-spacing:0.5px;">Custom EQ</p>
        <div style="display:flex;align-items:flex-end;height:140px;gap:2px;padding:0 4px;margin-bottom:20px;">
          ${freqLabels.map((lbl, i) => `
            <div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:4px;height:100%;">
              <div style="flex:1;display:flex;align-items:center;">
                <input type="range" class="eq-band-slider" data-band="${i}"
                  min="-12" max="12" step="0.5" value="${currentGains[i] || 0}"
                  style="-webkit-appearance:slider-vertical;writing-mode:vertical-lr;direction:rtl;
                         width:26px;height:96px;cursor:pointer;accent-color:var(--color-primary);" />
              </div>
              <span class="eq-db-label" data-band="${i}" style="font-size:0.58rem;color:var(--color-primary);font-weight:700;min-height:12px;">
                ${(currentGains[i]||0)>0?'+':''}${(currentGains[i]||0).toFixed(0)}
              </span>
              <span style="font-size:0.58rem;color:var(--text-muted);">${lbl}</span>
            </div>`).join('')}
        </div>

        <div style="background:var(--bg-elevated);border-radius:12px;padding:12px 14px;margin-bottom:14px;border:1px solid var(--border-color);">
          <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;">
            <span style="font-weight:600;font-size:0.875rem;">🔊 Bass Boost</span>
            <span id="bass-val" style="font-size:0.78rem;color:var(--color-primary);font-weight:700;">
              ${(EQ_PRESETS[currentPreset]?.bass||0)>=0?'+':''}${EQ_PRESETS[currentPreset]?.bass||0} dB
            </span>
          </div>
          <input type="range" id="bass-slider" min="-6" max="12" step="0.5"
            value="${EQ_PRESETS[currentPreset]?.bass||0}"
            style="width:100%;accent-color:var(--color-primary);" />
        </div>

        <button id="eq-reset-btn" class="btn btn-secondary btn-full">Reset to Normal</button>
      </div>`;

    document.body.appendChild(overlay);
    overlay.addEventListener('click', e => { if (e.target === overlay) overlay.remove(); });
    overlay.querySelector('#eq-close')?.addEventListener('click', () => overlay.remove());

    overlay.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        const key = btn.dataset.preset;
        applyPreset(key);
        overlay.querySelectorAll('.preset-btn').forEach(b => {
          const on = b.dataset.preset === key;
          b.style.borderColor = on ? 'var(--color-primary)' : 'var(--border-color)';
          b.style.background  = on ? 'rgba(168,85,247,0.18)' : 'var(--bg-elevated)';
          b.style.color       = on ? 'var(--color-primary)' : 'var(--text-secondary)';
        });
        const p = EQ_PRESETS[key];
        overlay.querySelectorAll('.eq-band-slider').forEach((s, i) => {
          s.value = p.bands[i];
          const l = overlay.querySelector(`.eq-db-label[data-band="${i}"]`);
          if (l) l.textContent = `${p.bands[i]>0?'+':''}${p.bands[i]}`;
        });
        const bs = overlay.querySelector('#bass-slider');
        const bv = overlay.querySelector('#bass-val');
        if (bs) bs.value = p.bass;
        if (bv) bv.textContent = `${p.bass>=0?'+':''}${p.bass} dB`;
        toast(`🎵 ${p.label}`, 'info', 1200);
      });
    });

    overlay.querySelectorAll('.eq-band-slider').forEach(s => {
      s.addEventListener('input', () => {
        const b = parseInt(s.dataset.band);
        const g = parseFloat(s.value);
        setEQBand(b, g);
        const l = overlay.querySelector(`.eq-db-label[data-band="${b}"]`);
        if (l) l.textContent = `${g>0?'+':''}${g.toFixed(0)}`;
        overlay.querySelectorAll('.preset-btn').forEach(b => {
          b.style.borderColor = 'var(--border-color)';
          b.style.background  = 'var(--bg-elevated)';
          b.style.color       = 'var(--text-secondary)';
        });
      });
    });

    overlay.querySelector('#bass-slider')?.addEventListener('input', e => {
      const v = parseFloat(e.target.value);
      setBassBoost(v);
      const bv = overlay.querySelector('#bass-val');
      if (bv) bv.textContent = `${v>=0?'+':''}${v.toFixed(1)} dB`;
    });

    overlay.querySelector('#eq-reset-btn')?.addEventListener('click', () => {
      applyPreset('normal');
      overlay.remove();
      toast('EQ reset ho gaya', 'info', 1500);
    });
  });
};
