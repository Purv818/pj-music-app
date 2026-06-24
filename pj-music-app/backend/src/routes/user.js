const express = require('express');
const router = express.Router();
const userController = require('../controllers/userController');
const { protect } = require('../middleware/auth');

// All routes require authentication
router.use(protect);

router.get('/search', userController.searchUsers);
router.get('/:id', userController.getProfile);
router.patch('/me', userController.updateProfile);
router.patch('/me/password', userController.changePassword);
router.delete('/me', userController.deactivateAccount);

module.exports = router;
