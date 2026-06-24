const express = require('express');
const router = express.Router();
const friendController = require('../controllers/friendController');
const { protect } = require('../middleware/auth');

router.use(protect);

router.get('/', friendController.getFriends);
router.get('/requests', friendController.getPendingRequests);
router.post('/request/:id', friendController.sendRequest);
router.post('/accept/:id', friendController.acceptRequest);
router.post('/reject/:id', friendController.rejectRequest);
router.delete('/:id', friendController.removeFriend);

module.exports = router;
