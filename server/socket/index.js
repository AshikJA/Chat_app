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
    socket.join(userId); // Join room named after MongoDB _id

    await User.findByIdAndUpdate(userId, { status: 'online' });

    // Send current online users list to the new user
    socket.emit('user:list', Array.from(onlineUsers.keys()));
    
    // Broadcast to others that this user is online
    socket.broadcast.emit('user:online', { userId, status: 'online' });

    socket.on('user:join', async () => {
      onlineUsers.set(userId, socket.id);
      socket.join(userId);
      if (socket.appUserId) {
        socket.join(socket.appUserId);
      }
      await User.findByIdAndUpdate(userId, { status: 'online' });
      
      socket.emit('user:list', Array.from(onlineUsers.keys()));
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

        const isReceiverOnline = onlineUsers.has(receiverId);
        if (isReceiverOnline) {
          await Message.findByIdAndUpdate(message._id, { status: 'delivered' });
          populated.status = 'delivered';
          // Emit to ALL tabs of the receiver
          io.to(receiverId).emit('message:receive', {
            message: populated,
          });
          // Emit to ALL tabs of the sender (to sync outgoing messages)
          io.to(userId).emit('message:delivered', { messageId: message._id });
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
          // Notify ALL tabs of the sender (the person who sent the messages)
          io.to(senderId).emit('message:seen', {
            by: userId,
          });
          // Notify other tabs of the receiver (the person who read the messages)
          io.to(userId).emit('message:sync_read', { senderId });
        }
      } catch {}
    });

    socket.on('user:typing', (data) => {
      const { receiverId, isTyping } = data;
      io.to(receiverId).emit('user:typing', {
        userId,
        isTyping,
      });
    });

    socket.on('call:initiate', (data) => {
      const { receiverId } = data;
      io.to(receiverId).emit('call:incoming', {
        from: userId,
      });
    });

    socket.on('call:offer', (data) => {
      const { receiverId, offer } = data;
      io.to(receiverId).emit('call:offer', {
        from: userId,
        offer,
      });
    });

    socket.on('call:answer', (data) => {
      const { receiverId, answer } = data;
      io.to(receiverId).emit('call:answer', {
        from: userId,
        answer,
      });
    });

    socket.on('call:ice-candidate', (data) => {
      const { receiverId, candidate } = data;
      io.to(receiverId).emit('call:ice-candidate', {
        from: userId,
        candidate,
      });
    });

    socket.on('call:end', (data) => {
      const { receiverId } = data;
      io.to(receiverId).emit('call:ended', {
        from: userId,
      });
    });

    socket.on('disconnect', async () => {
      if (onlineUsers.get(userId) === socket.id) {
        onlineUsers.delete(userId);
        await User.findByIdAndUpdate(userId, { status: 'offline' });
        io.emit('user:offline', { userId, status: 'offline' });
      }
    });
  });
};
