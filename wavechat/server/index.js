const express = require('express');
const mongoose = require('mongoose');
const cors = require('cors');
const dotenv = require('dotenv');
const path = require('path');
const http = require('http');
const { Server } = require('socket.io');

dotenv.config();

const app = express();
const server = http.createServer(app);

const io = new Server(server, {
  cors: {
    origin: process.env.CLIENT_URL || 'http://localhost:5173',
    methods: ['GET', 'POST'],
  },
});

app.use(cors());
app.use(express.json());

app.use('/api/auth', require('./routes/auth'));
app.use('/api/friends', require('./routes/friends')(io));
app.use('/api/upload', require('./routes/upload'));
app.use('/api/messages', require('./routes/messages'));

if (process.env.NODE_ENV === 'production') {
  app.use(express.static(path.join(__dirname, '../client/dist')));
  app.get('*', (req, res) => {
    res.sendFile(path.join(__dirname, '../client/dist/index.html'));
  });
}

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log('MongoDB connected'))
  .catch((err) => console.error('MongoDB connection error:', err));

io.on('connection', (socket) => {
  console.log('User connected:', socket.id);

  socket.on('user:join', (userId) => {
    socket.join(userId);
    console.log(`User ${userId} joined room ${userId}`);
  });

  socket.on('message:send', ({ receiverId, message }) => {
    io.to(receiverId).emit('message:receive', message);
  });

  socket.on('user:typing', ({ receiverId, isTyping }) => {
    io.to(receiverId).emit('typing:update', { userId: socket.userId, isTyping });
  });

  socket.on('friend:request', ({ receiverId, request }) => {
    io.to(receiverId).emit('friend:request', request);
  });

  socket.on('friend:accepted', ({ senderId, friendship }) => {
    io.to(senderId).emit('friend:accepted', friendship);
  });

  socket.on('call:initiate', ({ receiverId }) => {
    io.to(receiverId).emit('call:initiate', { callerId: socket.id });
  });

  socket.on('call:offer', ({ receiverId, offer }) => {
    io.to(receiverId).emit('call:offer', { offer, callerId: socket.id });
  });

  socket.on('call:answer', ({ receiverId, answer }) => {
    io.to(receiverId).emit('call:answer', { answer });
  });

  socket.on('call:ice-candidate', ({ receiverId, candidate }) => {
    io.to(receiverId).emit('call:ice-candidate', { candidate });
  });

  socket.on('call:end', ({ receiverId }) => {
    io.to(receiverId).emit('call:end');
  });

  socket.on('disconnect', async () => {
    console.log('User disconnected:', socket.id);
    try {
      await mongoose.model('User').findOneAndUpdate(
        { socketId: socket.id },
        { isOnline: false, lastSeen: new Date() }
      );
    } catch (err) {
      console.error('Error updating user status:', err);
    }
  });
});

server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
