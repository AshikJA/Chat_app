const express = require('express');
const auth = require('../middleware/auth');
const requireVerified = require('../middleware/verified');
const { uploadImage, uploadVideo, uploadVoice } = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const Message = require('../models/Message');
const onlineUsers = require('../socket/users');

const TYPE_MAP = {
  image: 'image',
  video: 'video',
  voice: 'voice',
};

const uploadConfig = {
  image: { middleware: uploadImage.single('file'), folder: 'chat/images', resourceType: 'image' },
  video: { middleware: uploadVideo.single('file'), folder: 'chat/videos', resourceType: 'video' },
  voice: { middleware: uploadVoice.single('file'), folder: 'chat/voice', resourceType: 'video' },
};

module.exports = (io) => {
  const router = express.Router();

  const handleUpload = (type) => async (req, res) => {
    try {
      if (!req.file) {
        return res.status(400).json({ message: 'No file provided' });
      }

      const config = uploadConfig[type];

      const result = await new Promise((resolve, reject) => {
        const stream = cloudinary.uploader.upload_stream(
          {
            folder: config.folder,
            resource_type: config.resourceType,
          },
          (error, result) => {
            if (error) reject(error);
            else resolve(result);
          }
        );
        stream.end(req.file.buffer);
      });

      const message = await Message.create({
        sender: req.user._id,
        receiver: req.body.receiverId,
        content: result.secure_url,
        type,
      });

      const populated = await message.populate('sender', 'name email avatar status');

      const receiverSocketId = onlineUsers.get(req.body.receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('message:receive', { message: populated });
      }

      res.json({ message: populated });
    } catch (error) {
      res.status(500).json({ message: error.message });
    }
  };

  router.post('/image', auth, requireVerified, uploadConfig.image.middleware, handleUpload('image'));
  router.post('/video', auth, requireVerified, uploadConfig.video.middleware, handleUpload('video'));
  router.post('/voice', auth, requireVerified, uploadConfig.voice.middleware, handleUpload('voice'));

  return router;
};
