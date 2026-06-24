/**
 * Song Controller
 * CRUD for song metadata. Actual audio files live on the device.
 * Handles bulk sync (device scan results), search, favorites, play stats.
 */

const Song = require('../models/Song');
const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');

// ─── Sync songs (bulk upsert from device scan) ────────────────────────────────

exports.syncSongs = async (req, res, next) => {
  try {
    const { songs } = req.body;

    if (!Array.isArray(songs) || songs.length === 0) {
      return sendError(res, 400, 'Songs array is required.');
    }

    if (songs.length > 5000) {
      return sendError(res, 400, 'Cannot sync more than 5000 songs at once.');
    }

    const userId = req.user._id;
    const ops = songs.map((song) => ({
      updateOne: {
        filter: { owner: userId, filePath: song.filePath },
        update: {
          $set: {
            title: song.title || 'Unknown',
            artist: song.artist || 'Unknown Artist',
            album: song.album || 'Unknown Album',
            genre: song.genre || '',
            duration: song.duration || 0,
            fileSize: song.fileSize || 0,
            mimeType: song.mimeType || 'audio/mpeg',
            trackNumber: song.trackNumber || 0,
            year: song.year || null,
            artwork: song.artwork || null,
            isDeleted: false,
          },
          $setOnInsert: { owner: userId, filePath: song.filePath },
        },
        upsert: true,
      },
    }));

    const result = await Song.bulkWrite(ops, { ordered: false });

    return sendSuccess(res, 200, 'Songs synced.', {
      upserted: result.upsertedCount,
      modified: result.modifiedCount,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get all songs for current user ──────────────────────────────────────────

exports.getMySongs = async (req, res, next) => {
  try {
    const { sortBy = 'title', order = 'asc', page = 1, limit = 100 } = req.query;

    const allowedSort = ['title', 'artist', 'album', 'playCount', 'createdAt', 'lastPlayed'];
    const sortField = allowedSort.includes(sortBy) ? sortBy : 'title';
    const sortOrder = order === 'desc' ? -1 : 1;

    const skip = (parseInt(page) - 1) * parseInt(limit);
    const cap = Math.min(parseInt(limit), 500);

    const [songs, total] = await Promise.all([
      Song.find({ owner: req.user._id })
        .sort({ [sortField]: sortOrder })
        .skip(skip)
        .limit(cap)
        .lean(),
      Song.countDocuments({ owner: req.user._id }),
    ]);

    return sendSuccess(res, 200, 'Songs retrieved.', {
      songs,
      total,
      page: parseInt(page),
      pages: Math.ceil(total / cap),
    });
  } catch (error) {
    next(error);
  }
};

// ─── Search songs ────────────────────────────────────────────────────────────

exports.searchSongs = async (req, res, next) => {
  try {
    const { q } = req.query;

    if (!q || q.trim().length < 1) {
      return sendError(res, 400, 'Search query is required.');
    }

    // Sanitize: escape regex special chars
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

    const songs = await Song.find({
      owner: req.user._id,
      $or: [
        { title: new RegExp(escaped, 'i') },
        { artist: new RegExp(escaped, 'i') },
        { album: new RegExp(escaped, 'i') },
        { genre: new RegExp(escaped, 'i') },
      ],
    })
      .limit(100)
      .lean();

    return sendSuccess(res, 200, 'Search results.', songs);
  } catch (error) {
    next(error);
  }
};

// ─── Increment play count ─────────────────────────────────────────────────────

exports.recordPlay = async (req, res, next) => {
  try {
    const song = await Song.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { $inc: { playCount: 1 }, $set: { lastPlayed: new Date() } },
      { new: true }
    );

    if (!song) return sendError(res, 404, 'Song not found.');

    return sendSuccess(res, 200, 'Play recorded.', { playCount: song.playCount });
  } catch (error) {
    next(error);
  }
};

// ─── Delete song (soft delete) ────────────────────────────────────────────────

exports.deleteSong = async (req, res, next) => {
  try {
    const song = await Song.findOneAndUpdate(
      { _id: req.params.id, owner: req.user._id },
      { isDeleted: true }
    );

    if (!song) return sendError(res, 404, 'Song not found.');

    return sendSuccess(res, 200, 'Song removed.');
  } catch (error) {
    next(error);
  }
};

// ─── Toggle favorite ─────────────────────────────────────────────────────────

exports.toggleFavorite = async (req, res, next) => {
  try {
    const songId = req.params.id;

    // Verify song belongs to user
    const song = await Song.findOne({ _id: songId, owner: req.user._id });
    if (!song) return sendError(res, 404, 'Song not found.');

    const user = await User.findById(req.user._id);
    const isFav = user.favorites.includes(songId);

    if (isFav) {
      user.favorites.pull(songId);
    } else {
      user.favorites.push(songId);
    }
    await user.save({ validateBeforeSave: false });

    return sendSuccess(res, 200, isFav ? 'Removed from favorites.' : 'Added to favorites.', {
      isFavorite: !isFav,
    });
  } catch (error) {
    next(error);
  }
};

// ─── Get favorites ────────────────────────────────────────────────────────────

exports.getFavorites = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id).populate({
      path: 'favorites',
      match: { isDeleted: false, owner: req.user._id },
    });

    return sendSuccess(res, 200, 'Favorites retrieved.', user.favorites);
  } catch (error) {
    next(error);
  }
};
