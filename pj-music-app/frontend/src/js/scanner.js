/**
 * PJ Music — Device Music Scanner
 *
 * PWA / Browser mein:
 *   - File picker se songs import karo
 *   - File objects IndexedDB mein store karo (permanent, session-independent)
 *   - App reopen pe automatically IndexedDB se load karo aur blob URLs banao
 *
 * Capacitor APK mein:
 *   - Downloads + Music folders automatically scan karo
 *   - Subfolders bhi scan karo
 */

import CONFIG from './config.js';
import api from './api.js';
import { toast } from './ui.js';

// ─── Constants ────────────────────────────────────────────────────────────────

const AUDIO_EXTENSIONS = ['.mp3', '.m4a', '.aac', '.ogg', '.wav', '.flac', '.opus', '.wma', '.mp4'];
const DB_NAME     = 'pj_music_files';
const DB_VERSION  = 1;
const STORE_FILES = 'audio_files';   // stores: { id, file, meta }
const STORE_META  = 'song_meta';     // stores: song metadata without File

// ─── IndexedDB Helper ─────────────────────────────────────────────────────────

const openDB = () => new Promise((resolve, reject) => {
  const req = indexedDB.open(DB_NAME, DB_VERSION);

  req.onupgradeneeded = (e) => {
    const db = e.target.result;
    if (!db.objectStoreNames.contains(STORE_FILES)) {
      db.createObjectStore(STORE_FILES, { keyPath: 'id' });
    }
    if (!db.objectStoreNames.contains(STORE_META)) {
      db.createObjectStore(STORE_META, { keyPath: 'id' });
    }
  };

  req.onsuccess  = (e) => resolve(e.target.result);
  req.onerror    = (e) => reject(e.target.error);
});

const dbPut = (db, store, value) => new Promise((resolve, reject) => {
  const tx  = db.transaction(store, 'readwrite');
  const req = tx.objectStore(store).put(value);
  req.onsuccess = () => resolve();
  req.onerror   = (e) => reject(e.target.error);
});

const dbGetAll = (db, store) => new Promise((resolve, reject) => {
  const tx  = db.transaction(store, 'readonly');
  const req = tx.objectStore(store).getAll();
  req.onsuccess = (e) => resolve(e.target.result || []);
  req.onerror   = (e) => reject(e.target.error);
});

const dbDelete = (db, store, key) => new Promise((resolve, reject) => {
  const tx  = db.transaction(store, 'readwrite');
  const req = tx.objectStore(store).delete(key);
  req.onsuccess = () => resolve();
  req.onerror   = (e) => reject(e.target.error);
});

// ─── Auto Scan on App Start ───────────────────────────────────────────────────

/**
 * App open hote hi songs load karo.
 * PWA: IndexedDB se stored files load karo aur blob URLs banao.
 * APK: Capacitor se native folder scan karo.
 *
 * @param {Function} onSongsFound — (songs[]) => void
 */
export const autoScanOnStartup = async (onSongsFound) => {
  try {
    const isNative = window?.Capacitor?.isNativePlatform?.()
                  || window?.Capacitor?.getPlatform?.() === 'android';

    if (isNative) {
      await scanNativeDevice(onSongsFound);
    } else {
      await loadFromIndexedDB(onSongsFound);
    }
  } catch (err) {
    console.warn('[Scanner] Startup scan error:', err.message);
  }
};

// ─── PWA: Load from IndexedDB ─────────────────────────────────────────────────

const loadFromIndexedDB = async (onSongsFound) => {
  try {
    const db      = await openDB();
    const records = await dbGetAll(db, STORE_FILES);

    if (records.length === 0) return; // Pehli baar — koi songs nahi

    const songs = [];
    const toDelete = [];

    for (const record of records) {
      try {
        // File object still accessible hai?
        if (record.file && record.file instanceof File) {
          // Naya blob URL banao (har session ke liye fresh)
          const blobUrl = URL.createObjectURL(record.file);
          songs.push({
            ...record.meta,
            _id:      record.id,
            filePath: blobUrl,
            _blobUrl: blobUrl,
            _file:    record.file,
            _fromDB:  true,
          });
        } else {
          // File corrupt/missing — delete karo
          toDelete.push(record.id);
        }
      } catch (_) {
        toDelete.push(record.id);
      }
    }

    // Dead entries clean karo
    for (const id of toDelete) {
      await dbDelete(db, STORE_FILES, id).catch(() => {});
    }

    if (songs.length > 0) {
      console.log(`[Scanner] ${songs.length} songs loaded from IndexedDB`);
      onSongsFound(songs);
    }
  } catch (err) {
    console.warn('[Scanner] IndexedDB load failed:', err.message);
  }
};

// ─── PWA: Save Files to IndexedDB ────────────────────────────────────────────

const saveFilesToIndexedDB = async (songs) => {
  try {
    const db = await openDB();
    for (const song of songs) {
      if (!song._file) continue;

      const id = song._id || generateId(song._file.name + song._file.size);

      await dbPut(db, STORE_FILES, {
        id,
        file: song._file,   // ← actual File object stored in IndexedDB
        meta: {
          title:    song.title,
          artist:   song.artist,
          album:    song.album,
          genre:    song.genre || '',
          duration: song.duration,
          fileSize: song.fileSize,
          mimeType: song.mimeType,
          artwork:  song.artwork || null,
        },
      });
    }
    console.log(`[Scanner] ${songs.length} songs saved to IndexedDB`);
  } catch (err) {
    console.warn('[Scanner] IndexedDB save failed:', err.message);
  }
};

// ─── Native APK: Scan Device Folders ─────────────────────────────────────────

const scanNativeDevice = async (onSongsFound) => {
  const { Filesystem } = window?.CapacitorPlugins || {};
  if (!Filesystem) {
    console.warn('[Scanner] Filesystem plugin not available');
    return;
  }

  const DIRS = ['DOWNLOADS', 'MUSIC', 'EXTERNAL_STORAGE'];

  toast('🎵 Music scan ho rahi hai...', 'info', 2500);

  const foundSongs = [];

  for (const dir of DIRS) {
    try {
      const result = await Filesystem.readdir({ path: '', directory: dir });

      // Root audio files
      for (const file of result.files) {
        if (isAudioFile(file.name)) {
          try {
            const stat = await Filesystem.stat({ path: file.name, directory: dir });
            foundSongs.push(buildNativeSong(file.name, stat.uri, stat.size || 0));
          } catch (_) {}
        }
      }

      // 1-level subfolders
      for (const folder of result.files.filter(f => f.type === 'directory')) {
        try {
          const sub = await Filesystem.readdir({ path: folder.name, directory: dir });
          for (const file of sub.files) {
            if (isAudioFile(file.name)) {
              try {
                const fullPath = `${folder.name}/${file.name}`;
                const stat = await Filesystem.stat({ path: fullPath, directory: dir });
                foundSongs.push(buildNativeSong(file.name, stat.uri, stat.size || 0));
              } catch (_) {}
            }
          }
        } catch (_) {}
      }
    } catch (_) {}
  }

  const unique = deduplicateSongs(foundSongs);

  if (unique.length > 0) {
    toast(`✅ ${unique.length} songs mili!`, 'success');
    onSongsFound(unique);
    syncSongsToServer(unique).catch(() => {});
  } else {
    toast('Koi songs nahi mili. Import button se add karo.', 'info');
  }
};

// ─── Manual File Picker ───────────────────────────────────────────────────────

/**
 * User file picker se files choose kare.
 * Files IndexedDB mein save hoti hain — PWA reopen pe bhi rehti hain.
 */
export const scanFromFilePicker = async () => {
  return new Promise((resolve) => {
    const input = document.createElement('input');
    input.type     = 'file';
    input.accept   = CONFIG.SUPPORTED_AUDIO.join(',');
    input.multiple = true;

    input.onchange = async () => {
      if (!input.files?.length) { resolve([]); return; }

      const songs = [];

      for (const file of input.files) {
        const song = await extractFileMetadata(file);
        songs.push(song);
      }

      // IndexedDB mein save karo (persistent storage)
      await saveFilesToIndexedDB(songs);

      resolve(songs);
    };

    input.oncancel = () => resolve([]);

    // Mobile pe input must be in DOM briefly
    input.style.display = 'none';
    document.body.appendChild(input);
    input.click();
    setTimeout(() => input.remove(), 1000);
  });
};

// ─── Delete Song from Storage ─────────────────────────────────────────────────

/**
 * Song ko IndexedDB se delete karo.
 * @param {string} songId
 */
export const deleteSongFromStorage = async (songId) => {
  try {
    const db = await openDB();
    await dbDelete(db, STORE_FILES, songId);
  } catch (_) {}
};

// ─── Metadata Extraction ─────────────────────────────────────────────────────

const extractFileMetadata = async (file) => {
  const blobUrl  = URL.createObjectURL(file);
  const duration = await getAudioDuration(blobUrl);
  const { title, artist } = parseFilename(file.name);
  const id = generateId(file.name + file.size);

  return {
    _id:      id,
    title,
    artist,
    album:    'Unknown Album',
    genre:    '',
    filePath: blobUrl,
    fileSize: file.size,
    mimeType: file.type || 'audio/mpeg',
    duration,
    artwork:  null,
    _file:    file,
    _blobUrl: blobUrl,
  };
};

const buildNativeSong = (filename, uri, fileSize) => {
  const { title, artist } = parseFilename(filename);
  const ext = filename.split('.').pop().toLowerCase();
  const id  = generateId(uri);

  return {
    _id:      id,
    title,
    artist,
    album:    'Unknown Album',
    genre:    '',
    filePath: uri,
    fileSize,
    mimeType: `audio/${ext === 'mp3' ? 'mpeg' : ext}`,
    duration: 0,
    artwork:  null,
    _file:    null,
    _blobUrl: null,
  };
};

// ─── Helpers ─────────────────────────────────────────────────────────────────

/** "Arijit - Tum Hi Ho.mp3" → { artist: "Arijit", title: "Tum Hi Ho" } */
const parseFilename = (filename) => {
  const nameWithoutExt = filename.replace(/\.[^/.]+$/, '').trim();
  if (nameWithoutExt.includes(' - ')) {
    const parts  = nameWithoutExt.split(' - ');
    const artist = parts[0].trim();
    const title  = parts.slice(1).join(' - ').trim();
    return { title, artist };
  }
  return { title: nameWithoutExt, artist: 'Unknown Artist' };
};

const isAudioFile = (name) =>
  AUDIO_EXTENSIONS.some(ext => name.toLowerCase().endsWith(ext));

const deduplicateSongs = (songs) => {
  const seen = new Set();
  return songs.filter(s => {
    if (seen.has(s.filePath)) return false;
    seen.add(s.filePath);
    return true;
  });
};

const generateId = (seed) => {
  let hash = 0;
  for (const c of String(seed)) {
    hash = ((hash << 5) - hash) + c.charCodeAt(0);
    hash |= 0;
  }
  return 'local_' + Math.abs(hash).toString(36);
};

const getAudioDuration = (src) => new Promise((resolve) => {
  const a      = new Audio();
  a.preload    = 'metadata';
  a.onloadedmetadata = () => resolve(Math.round(a.duration) || 0);
  a.onerror    = () => resolve(0);
  a.src        = src;
  setTimeout(() => resolve(0), 4000);
});

// ─── Server Sync ──────────────────────────────────────────────────────────────

export const syncSongsToServer = async (songs) => {
  if (!songs?.length) return;
  const sanitized = songs.map(({ _file, _blobUrl, _fromDB, ...rest }) => rest);
  try {
    await api.post('/songs/sync', { songs: sanitized });
  } catch (_) {}
};

export const getPlaybackUrl = (song) => {
  if (song._blobUrl) return song._blobUrl;
  if (song._file) {
    song._blobUrl = URL.createObjectURL(song._file);
    return song._blobUrl;
  }
  return song.filePath;
};
