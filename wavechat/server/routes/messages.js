const router = require('express').Router();
const auth = require('../middleware/auth');
const Message = require('../models/Message');

router.get('/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    const messages = await Message.find({
      $or: [
        { sender: currentUserId, receiver: userId },
        { sender: userId, receiver: currentUserId },
      ],
    }).sort({ createdAt: 1 });

    res.json({ messages });
  } catch (err) {
    console.error('Get messages error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.put('/read/:userId', auth, async (req, res) => {
  try {
    const currentUserId = req.user.id;
    const { userId } = req.params;

    await Message.updateMany(
      { sender: userId, receiver: currentUserId, isRead: false },
      { isRead: true }
    );

    res.json({ message: 'Messages marked as read' });
  } catch (err) {
    console.error('Mark read error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
