const express = require('express');
const router = express.Router();
const songController = require('../controllers/songController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.post('/sync', songController.syncSongs);
router.get('/', songController.getMySongs);
router.get('/search', songController.searchSongs);
router.get('/favorites', songController.getFavorites);
router.post('/:id/play', songController.recordPlay);
router.post('/:id/favorite', songController.toggleFavorite);
router.delete('/:id', songController.deleteSong);

module.exports = router;
