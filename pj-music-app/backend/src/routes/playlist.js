const express = require('express');
const router = express.Router();
const playlistController = require('../controllers/playlistController');
const { protect } = require('../middleware/auth');
const { validatePlaylist } = require('../middleware/validate');

router.use(protect);

router.post('/', validatePlaylist, playlistController.createPlaylist);
router.get('/', playlistController.getMyPlaylists);
router.get('/:id', playlistController.getPlaylist);
router.patch('/:id', playlistController.updatePlaylist);
router.delete('/:id', playlistController.deletePlaylist);
router.post('/:id/songs', playlistController.addSong);
router.delete('/:id/songs/:songId', playlistController.removeSong);
router.patch('/:id/songs/reorder', playlistController.reorderSongs);

module.exports = router;
