/**
 * Friend Controller
 * Send/accept/reject/remove friend requests.
 */

const User = require('../models/User');
const { sendSuccess, sendError } = require('../utils/apiResponse');
const logger = require('../utils/logger');

// ─── Send friend request ─────────────────────────────────────────────────────

exports.sendRequest = async (req, res, next) => {
  try {
    const targetId = req.params.id;

    if (targetId === req.user._id.toString()) {
      return sendError(res, 400, 'Cannot send a friend request to yourself.');
    }

    const [sender, target] = await Promise.all([
      User.findById(req.user._id),
      User.findById(targetId),
    ]);

    if (!target || !target.isActive) {
      return sendError(res, 404, 'User not found.');
    }

    // Check already friends
    if (sender.friends.includes(targetId)) {
      return sendError(res, 409, 'You are already friends.');
    }

    // Check already sent
    if (sender.friendRequests.sent.includes(targetId)) {
      return sendError(res, 409, 'Friend request already sent.');
    }

    // Check if target already sent a request to sender (auto-accept)
    if (sender.friendRequests.received.includes(targetId)) {
      // Auto-accept
      sender.friends.push(targetId);
      target.friends.push(req.user._id);
      sender.friendRequests.received.pull(targetId);
      target.friendRequests.sent.pull(req.user._id);

      await Promise.all([sender.save({ validateBeforeSave: false }), target.save({ validateBeforeSave: false })]);

      return sendSuccess(res, 200, 'Friend request accepted automatically. You are now friends!');
    }

    sender.friendRequests.sent.push(targetId);
    target.friendRequests.received.push(req.user._id);

    await Promise.all([
      sender.save({ validateBeforeSave: false }),
      target.save({ validateBeforeSave: false }),
    ]);

    logger.info(`Friend request sent: ${req.user._id} → ${targetId}`);

    return sendSuccess(res, 200, 'Friend request sent.');
  } catch (error) {
    next(error);
  }
};

// ─── Accept friend request ────────────────────────────────────────────────────

exports.acceptRequest = async (req, res, next) => {
  try {
    const senderId = req.params.id;

    const [me, sender] = await Promise.all([
      User.findById(req.user._id),
      User.findById(senderId),
    ]);

    if (!sender) return sendError(res, 404, 'User not found.');

    if (!me.friendRequests.received.includes(senderId)) {
      return sendError(res, 400, 'No pending friend request from this user.');
    }

    me.friends.push(senderId);
    sender.friends.push(req.user._id);
    me.friendRequests.received.pull(senderId);
    sender.friendRequests.sent.pull(req.user._id);

    await Promise.all([
      me.save({ validateBeforeSave: false }),
      sender.save({ validateBeforeSave: false }),
    ]);

    return sendSuccess(res, 200, 'Friend request accepted.');
  } catch (error) {
    next(error);
  }
};

// ─── Reject friend request ────────────────────────────────────────────────────

exports.rejectRequest = async (req, res, next) => {
  try {
    const senderId = req.params.id;

    const [me, sender] = await Promise.all([
      User.findById(req.user._id),
      User.findById(senderId),
    ]);

    if (!sender) return sendError(res, 404, 'User not found.');

    me.friendRequests.received.pull(senderId);
    sender.friendRequests.sent.pull(req.user._id);

    await Promise.all([
      me.save({ validateBeforeSave: false }),
      sender.save({ validateBeforeSave: false }),
    ]);

    return sendSuccess(res, 200, 'Friend request rejected.');
  } catch (error) {
    next(error);
  }
};

// ─── Remove friend ────────────────────────────────────────────────────────────

exports.removeFriend = async (req, res, next) => {
  try {
    const friendId = req.params.id;

    const [me, friend] = await Promise.all([
      User.findById(req.user._id),
      User.findById(friendId),
    ]);

    if (!friend) return sendError(res, 404, 'User not found.');

    me.friends.pull(friendId);
    friend.friends.pull(req.user._id);

    await Promise.all([
      me.save({ validateBeforeSave: false }),
      friend.save({ validateBeforeSave: false }),
    ]);

    return sendSuccess(res, 200, 'Friend removed.');
  } catch (error) {
    next(error);
  }
};

// ─── List friends ─────────────────────────────────────────────────────────────

exports.getFriends = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friends', 'username displayName avatar lastSeen');

    return sendSuccess(res, 200, 'Friends retrieved.', user.friends);
  } catch (error) {
    next(error);
  }
};

// ─── List pending requests ────────────────────────────────────────────────────

exports.getPendingRequests = async (req, res, next) => {
  try {
    const user = await User.findById(req.user._id)
      .populate('friendRequests.received', 'username displayName avatar')
      .populate('friendRequests.sent', 'username displayName avatar');

    return sendSuccess(res, 200, 'Pending requests.', {
      received: user.friendRequests.received,
      sent: user.friendRequests.sent,
    });
  } catch (error) {
    next(error);
  }
};
