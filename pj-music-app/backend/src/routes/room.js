const express = require('express');
const router = express.Router();
const roomController = require('../controllers/roomController');
const { protect } = require('../middleware/auth');
const { validateRoom } = require('../middleware/validate');

router.use(protect);

router.post('/', validateRoom, roomController.createRoom);
router.get('/', roomController.getMyRooms);
router.get('/:id', roomController.getRoom);
router.post('/:id/invite', roomController.inviteToRoom);
router.post('/join', roomController.joinRoom);
router.post('/:id/leave', roomController.leaveRoom);
router.patch('/:id/playback', roomController.updatePlayback);

module.exports = router;
