const jwt = require('jsonwebtoken');
const User = require('../models/User');
const Message = require('../models/Message');
const onlineUsers = require('./users');

module.exports = (io) => {
  io.use(async (socket, next) => {
    try {
      const token = socket.handshake.auth.token;
      if (!token) {
        return next(new Error('Authentication required'));
      }
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      const user = await User.findById(decoded.id);
      if (!user) {
        return next(new Error('User not found'));
      }
      if (!user.isVerified) {
        return next(new Error('Email verification required'));
      }
      socket.userId = user._id.toString();
      socket.appUserId = user.userId;
      next();
    } catch {
      next(new Error('Invalid token'));
    }
  });

  io.on('connection', async (socket) => {
    const userId = socket.userId;
    onlineUsers.set(userId, socket.id);

    await User.findByIdAndUpdate(userId, { status: 'online' });

    io.emit('user:online', { userId, status: 'online' });

    socket.on('user:join', async () => {
      onlineUsers.set(userId, socket.id);
      if (socket.appUserId) {
        socket.join(socket.appUserId);
      }
      await User.findByIdAndUpdate(userId, { status: 'online' });
      io.emit('user:online', { userId, status: 'online' });
    });

    socket.on('message:send', async (data, callback) => {
      try {
        const { receiverId, content, type = 'text' } = data;

        if (!receiverId || !content) {
          callback?.({ error: 'receiverId and content are required' });
          return;
        }

        const message = await Message.create({
          sender: userId,
          receiver: receiverId,
          content,
          type,
        });

        const populated = await message.populate('sender', 'name email avatar status');

        const receiverSocketId = onlineUsers.get(receiverId);
        if (receiverSocketId) {
          await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
          populated.status = 'delivered';
          io.to(receiverSocketId).emit('message:receive', {
            message: populated,
          });
          io.to(socket.id).emit('message:delivered', { messageId: message._id });
        }

        callback?.({ message: populated });
      } catch (error) {
        callback?.({ error: error.message });
      }
    });

    socket.on('message:read', async ({ senderId }) => {
      try {
        const result = await Message.updateMany(
          { sender: senderId, receiver: userId, status: { $ne: 'seen' } },
          { status: 'seen' }
        );
        if (result.modifiedCount > 0) {
          const senderSocketId = onlineUsers.get(senderId);
          if (senderSocketId) {
            io.to(senderSocketId).emit('message:seen', {
              by: userId,
            });
          }
        }
      } catch {}
    });

    socket.on('user:typing', (data) => {
      const { receiverId, isTyping } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('user:typing', {
          userId,
          isTyping,
        });
      }
    });

    socket.on('call:initiate', (data) => {
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call:incoming', {
          from: userId,
        });
      }
    });

    socket.on('call:offer', (data) => {
      const { receiverId, offer } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call:offer', {
          from: userId,
          offer,
        });
      }
    });

    socket.on('call:answer', (data) => {
      const { receiverId, answer } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call:answer', {
          from: userId,
          answer,
        });
      }
    });

    socket.on('call:ice-candidate', (data) => {
      const { receiverId, candidate } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call:ice-candidate', {
          from: userId,
          candidate,
        });
      }
    });

    socket.on('call:end', (data) => {
      const { receiverId } = data;
      const receiverSocketId = onlineUsers.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('call:ended', {
          from: userId,
        });
      }
    });

    socket.on('disconnect', async () => {
      onlineUsers.delete(userId);
      await User.findByIdAndUpdate(userId, { status: 'offline' });
      io.emit('user:offline', { userId, status: 'offline' });
    });
  });
};
