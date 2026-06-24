/**
 * Playlist Controller
 * Create, update, delete playlists; add/remove/reorder songs.
 */

const Playlist = require('../models/Playlist');
const Song = require('../models/Song');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ─── Create playlist ──────────────────────────────────────────────────────────

exports.createPlaylist = async (req, res, next) => {
  try {
    const { name, description, isPublic } = req.body;

    const playlist = await Playlist.create({
      owner: req.user._id,
      name,
      description,
      isPublic: !!isPublic,
    });

    return sendSuccess(res, 201, 'Playlist created.', playlist);
  } catch (error) {
    next(error);
  }
};

// ─── Get all playlists for current user ───────────────────────────────────────

exports.getMyPlaylists = async (req, res, next) => {
  try {
    const playlists = await Playlist.find({ owner: req.user._id })
      .select('name description artwork isPublic songs createdAt')
      .lean();

    // Add song count
    const result = playlists.map((p) => ({ ...p, songCount: p.songs.length }));

    return sendSuccess(res, 200, 'Playlists retrieved.', result);
  } catch (error) {
    next(error);
  }
};

// ─── Get single playlist ──────────────────────────────────────────────────────

exports.getPlaylist = async (req, res, next) => {
  try {
    const playlist = await Playlist.findById(req.params.id)
      .populate({ path: 'songs.song', match: { isDeleted: false } });

    if (!playlist) return sendError(res, 404, 'Playlist not found.');

    // Only owner can view private playlists
    if (!playlist.isPublic && !playlist.owner.equals(req.user._id)) {
      return sendError(res, 403, 'Access denied.');
    }

    return sendSuccess(res, 200, 'Playlist retrieved.', playlist);
  } catch (error) {
    next(error);
  }
};

// ─── Update playlist ──────────────────────────────────────────────────────────

exports.updatePlaylist = async (req, res, next) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, owner: req.user._id });
    if (!playlist) return sendError(res, 404, 'Playlist not found.');

    const { name, description, artwork, isPublic } = req.body;
    if (name !== undefined) playlist.name = name;
    if (description !== undefined) playlist.description = description;
    if (artwork !== undefined) playlist.artwork = artwork;
    if (isPublic !== undefined) playlist.isPublic = isPublic;

    await playlist.save();

    return sendSuccess(res, 200, 'Playlist updated.', playlist);
  } catch (error) {
    next(error);
  }
};

// ─── Delete playlist ──────────────────────────────────────────────────────────

exports.deletePlaylist = async (req, res, next) => {
  try {
    const playlist = await Playlist.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { isDeleted: true }
    );

    if (!playlist) return sendError(res, 404, 'Playlist not found.');

    return sendSuccess(res, 200, 'Playlist deleted.');
  } catch (error) {
    next(error);
  }
};

// ─── Add song to playlist ─────────────────────────────────────────────────────

exports.addSong = async (req, res, next) => {
  try {
    const { songId } = req.body;
    if (!songId) return sendError(res, 400, 'Song ID required.');

    // Verify song belongs to user
    const song = await Song.findOne({ _id: songId, owner: req.user._id });
    if (!song) return sendError(res, 404, 'Song not found.');

    const playlist = await Playlist.findOne({ _id: req.params.id, owner: req.user._id });
    if (!playlist) return sendError(res, 404, 'Playlist not found.');

    // Prevent duplicates
    const alreadyIn = playlist.songs.some((s) => s.song.toString() === songId);
    if (alreadyIn) return sendError(res, 409, 'Song already in playlist.');

    playlist.songs.push({ song: songId });
    await playlist.save();

    return sendSuccess(res, 200, 'Song added to playlist.', { songCount: playlist.songs.length });
  } catch (error) {
    next(error);
  }
};

// ─── Remove song from playlist ────────────────────────────────────────────────

exports.removeSong = async (req, res, next) => {
  try {
    const playlist = await Playlist.findOne({ _id: req.params.id, owner: req.user._id });
    if (!playlist) return sendError(res, 404, 'Playlist not found.');

    const beforeLen = playlist.songs.length;
    playlist.songs = playlist.songs.filter(
      (s) => s.song.toString() !== req.params.songId
    );

    if (playlist.songs.length === beforeLen) {
      return sendError(res, 404, 'Song not found in playlist.');
    }

    await playlist.save();

    return sendSuccess(res, 200, 'Song removed from playlist.', { songCount: playlist.songs.length });
  } catch (error) {
    next(error);
  }
};

// ─── Reorder songs ────────────────────────────────────────────────────────────

exports.reorderSongs = async (req, res, next) => {
  try {
    const { orderedSongIds } = req.body;

    if (!Array.isArray(orderedSongIds)) {
      return sendError(res, 400, 'orderedSongIds array required.');
    }

    const playlist = await Playlist.findOne({ _id: req.params.id, owner: req.user._id });
    if (!playlist) return sendError(res, 404, 'Playlist not found.');

    // Build a map of current entries
    const songMap = {};
    playlist.songs.forEach((entry) => {
      songMap[entry.song.toString()] = entry;
    });

    // Rebuild in new order (ignore unknown IDs)
    const reordered = orderedSongIds
      .filter((id) => songMap[id])
      .map((id) => songMap[id]);

    playlist.songs = reordered;
    await playlist.save();

    return sendSuccess(res, 200, 'Playlist reordered.');
  } catch (error) {
    next(error);
  }
};
