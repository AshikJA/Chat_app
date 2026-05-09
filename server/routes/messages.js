const express = require('express');
const auth = require('../middleware/auth');
const requireVerified = require('../middleware/verified');
const Message = require('../models/Message');

const router = express.Router();

router.get('/', auth, requireVerified, async (req, res) => {
  try {
    const { userId } = req.query;
    const messages = await Message.find({
      $or: [
        { sender: req.user._id, receiver: userId },
        { sender: userId, receiver: req.user._id },
      ],
    })
      .sort({ createdAt: 1 })
      .populate('sender', 'name email avatar status');

    res.json({ messages });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

module.exports = router;
