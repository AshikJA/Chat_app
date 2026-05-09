const express = require('express');
const auth = require('../middleware/auth');
const User = require('../models/User');

const router = express.Router();

module.exports = (io) => {

router.get('/search', auth, async (req, res) => {
  try {
    const { query } = req.query;

    if (!query || query.trim().length === 0) {
      return res.status(400).json({ message: 'Search query is required' });
    }

    const trimmed = query.trim().replace(/^@/, '');
    const hasUserId = /WC#/i.test(trimmed);

    let users;
    if (hasUserId) {
      const id = trimmed.toUpperCase().includes('WC#') ? trimmed.toUpperCase() : `WC#${trimmed.toUpperCase()}`;
      users = await User.find({ userId: id, _id: { $ne: req.user._id } }).select('userId username name avatar status');
    } else {
      const escaped = trimmed.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      users = await User.find({
        _id: { $ne: req.user._id },
        $or: [
          { username: { $regex: `^${escaped}`, $options: 'i' } },
          { name: { $regex: `^${escaped}`, $options: 'i' } },
        ],
      }).select('userId username name avatar status');
    }

    res.json({ users });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/request/:userId', auth, async (req, res) => {
  try {
    const targetUser = await User.findOne({ userId: req.params.userId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    if (targetUser._id.equals(req.user._id)) {
      return res.status(400).json({ message: 'Cannot send friend request to yourself' });
    }

    if (req.user.friends.some((f) => f.equals(targetUser._id))) {
      return res.status(400).json({ message: 'Already friends' });
    }

    const existingRequest = targetUser.friendRequests.find(
      (fr) => fr.from.equals(req.user._id) && fr.status === 'pending'
    );
    if (existingRequest) {
      return res.status(400).json({ message: 'Friend request already sent' });
    }

    const reverseRequest = req.user.friendRequests.find(
      (fr) => fr.from.equals(targetUser._id) && fr.status === 'pending'
    );
    if (reverseRequest) {
      return res.status(400).json({ message: 'This user has already sent you a friend request' });
    }

    targetUser.friendRequests.push({ from: req.user._id, status: 'pending', createdAt: new Date() });
    await targetUser.save();

    io.to(targetUser.userId).emit('friend:request', {
      from: {
        userId: req.user.userId,
        name: req.user.name,
        avatar: req.user.avatar,
      },
    });

    res.json({ message: 'Friend request sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/accept/:userId', auth, async (req, res) => {
  try {
    const requester = await User.findOne({ userId: req.params.userId });
    if (!requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    const request = req.user.friendRequests.find(
      (fr) => fr.from.equals(requester._id) && fr.status === 'pending'
    );
    if (!request) {
      return res.status(400).json({ message: 'No pending friend request from this user' });
    }

    request.status = 'accepted';

    if (!req.user.friends.some((f) => f.equals(requester._id))) {
      req.user.friends.push(requester._id);
    }
    await req.user.save();

    if (!requester.friends.some((f) => f.equals(req.user._id))) {
      requester.friends.push(req.user._id);
    }
    await requester.save();

    io.to(requester.userId).emit('friend:accepted', {
      from: {
        userId: req.user.userId,
        name: req.user.name,
        avatar: req.user.avatar,
      },
    });

    res.json({ message: 'Friend request accepted' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/reject/:userId', auth, async (req, res) => {
  try {
    const requester = await User.findOne({ userId: req.params.userId });
    if (!requester) {
      return res.status(404).json({ message: 'User not found' });
    }

    const requestIndex = req.user.friendRequests.findIndex(
      (fr) => fr.from.equals(requester._id) && fr.status === 'pending'
    );
    if (requestIndex === -1) {
      return res.status(400).json({ message: 'No pending friend request from this user' });
    }

    req.user.friendRequests.splice(requestIndex, 1);
    await req.user.save();

    io.to(requester.userId).emit('friend:rejected', {
      from: {
        userId: req.user.userId,
        name: req.user.name,
      },
    });

    res.json({ message: 'Friend request rejected' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/list', auth, async (req, res) => {
  try {
    await req.user.populate('friends', 'userId username name avatar status lastSeen');
    res.json({ friends: req.user.friends });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/requests', auth, async (req, res) => {
  try {
    const pendingRequests = req.user.friendRequests.filter(
      (fr) => fr.status === 'pending'
    );

    const fromIds = pendingRequests.map((fr) => fr.from);
    const requestUsers = await User.find({ _id: { $in: fromIds } }).select('userId username name avatar status');

    const requests = pendingRequests.map((fr) => {
      const user = requestUsers.find((u) => u._id.equals(fr.from));
      return {
        _id: fr._id,
        from: user
          ? { id: user._id, userId: user.userId, username: user.username, name: user.name, avatar: user.avatar, status: user.status }
          : fr.from,
        status: fr.status,
        createdAt: fr.createdAt,
      };
    });

    res.json({ requests });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.delete('/remove/:userId', auth, async (req, res) => {
  try {
    const targetUser = await User.findOne({ userId: req.params.userId });
    if (!targetUser) {
      return res.status(404).json({ message: 'User not found' });
    }

    const myIndex = req.user.friends.findIndex((f) => f.equals(targetUser._id));
    if (myIndex === -1) {
      return res.status(400).json({ message: 'User is not in your friends list' });
    }

    req.user.friends.splice(myIndex, 1);
    await req.user.save();

    const theirIndex = targetUser.friends.findIndex((f) => f.equals(req.user._id));
    if (theirIndex !== -1) {
      targetUser.friends.splice(theirIndex, 1);
      await targetUser.save();
    }

    res.json({ message: 'Friend removed' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

  return router;
};
