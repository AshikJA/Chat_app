const router = require('express').Router();
const auth = require('../middleware/auth');
const User = require('../models/User');

module.exports = function (io) {

  router.get('/search', auth, async (req, res) => {
    try {
      const { query } = req.query;
      if (!query) return res.status(400).json({ error: 'Query parameter required' });

      const isUserId = /^WC#\d{4}$/i.test(query);

      const filter = isUserId
        ? { userId: { $regex: new RegExp(`^${query}$`, 'i') } }
        : { username: { $regex: new RegExp(query, 'i') } };

      const users = await User.find(filter)
        .select('name avatar userId username status')
        .limit(20);

      res.json({ users });
    } catch (err) {
      console.error('Search error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/request/:userId', auth, async (req, res) => {
    try {
      const senderId = req.user.id;
      const { userId: receiverId } = req.params;

      if (senderId === receiverId) {
        return res.status(400).json({ error: 'Cannot send request to yourself' });
      }

      const receiver = await User.findById(receiverId);
      if (!receiver) return res.status(404).json({ error: 'User not found' });

      const sender = await User.findById(senderId);
      if (!sender) return res.status(404).json({ error: 'Sender not found' });

      if (sender.friends.includes(receiverId)) {
        return res.status(400).json({ error: 'Already friends' });
      }

      const alreadyRequested = receiver.friendRequests.find(
        (r) => r.from.toString() === senderId && r.status === 'pending'
      );
      if (alreadyRequested) {
        return res.status(400).json({ error: 'Friend request already sent' });
      }

      receiver.friendRequests.push({ from: senderId, status: 'pending', createdAt: new Date() });
      await receiver.save();

      const populated = await User.findById(senderId).select('name avatar userId username status');

      io.to(receiverId).emit('friend:request', {
        from: {
          id: populated._id,
          name: populated.name,
          avatar: populated.avatar,
          userId: populated.userId,
          username: populated.username,
          status: populated.status,
        },
        status: 'pending',
        createdAt: new Date(),
      });

      res.json({ message: 'Friend request sent' });
    } catch (err) {
      console.error('Request error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/accept/:userId', auth, async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { userId: senderId } = req.params;

      const currentUser = await User.findById(currentUserId);
      if (!currentUser) return res.status(404).json({ error: 'User not found' });

      const request = currentUser.friendRequests.find(
        (r) => r.from.toString() === senderId && r.status === 'pending'
      );
      if (!request) return res.status(400).json({ error: 'No pending request from this user' });

      request.status = 'accepted';

      if (!currentUser.friends.includes(senderId)) {
        currentUser.friends.push(senderId);
      }

      const sender = await User.findById(senderId);
      if (sender && !sender.friends.includes(currentUserId)) {
        sender.friends.push(currentUserId);
      }

      await currentUser.save();
      if (sender) await sender.save();

      io.to(senderId).emit('friend:accepted', {
        friend: {
          id: currentUser._id,
          name: currentUser.name,
          avatar: currentUser.avatar,
          userId: currentUser.userId,
          username: currentUser.username,
          status: currentUser.status,
        },
      });

      res.json({ message: 'Friend request accepted' });
    } catch (err) {
      console.error('Accept error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.post('/reject/:userId', auth, async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { userId: senderId } = req.params;

      const currentUser = await User.findById(currentUserId);
      if (!currentUser) return res.status(404).json({ error: 'User not found' });

      currentUser.friendRequests = currentUser.friendRequests.filter(
        (r) => !(r.from.toString() === senderId && r.status === 'pending')
      );

      await currentUser.save();

      res.json({ message: 'Friend request rejected' });
    } catch (err) {
      console.error('Reject error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.get('/list', auth, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).populate(
        'friends',
        'name username userId avatar status publicKey'
      );

      res.json({ friends: user.friends });
    } catch (err) {
      console.error('List error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.get('/requests', auth, async (req, res) => {
    try {
      const user = await User.findById(req.user.id).populate(
        'friendRequests.from',
        'name username userId avatar status'
      );

      const pending = user.friendRequests.filter((r) => r.status === 'pending');

      res.json({ requests: pending });
    } catch (err) {
      console.error('Requests error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  router.delete('/remove/:userId', auth, async (req, res) => {
    try {
      const currentUserId = req.user.id;
      const { userId: friendId } = req.params;

      const currentUser = await User.findById(currentUserId);
      const friend = await User.findById(friendId);

      if (!currentUser || !friend) {
        return res.status(404).json({ error: 'User not found' });
      }

      currentUser.friends = currentUser.friends.filter(
        (id) => id.toString() !== friendId
      );
      friend.friends = friend.friends.filter(
        (id) => id.toString() !== currentUserId
      );

      await currentUser.save();
      await friend.save();

      res.json({ message: 'Friend removed' });
    } catch (err) {
      console.error('Remove error:', err);
      res.status(500).json({ error: 'Server error' });
    }
  });

  return router;
};
