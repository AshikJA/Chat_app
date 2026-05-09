require('dotenv').config();
const express = require('express');
const http = require('http');
const mongoose = require('mongoose');
const cors = require('cors');
const { Server } = require('socket.io');
const authRoutes = require('./routes/auth');
const messageRoutes = require('./routes/messages');
const createUploadRoutes = require('./routes/upload');
const createFriendRoutes = require('./routes/friends');
const socketHandler = require('./socket');

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

app.get('/api/ice-servers', (req, res) => {
  const servers = [
    { urls: process.env.STUN_SERVER || 'stun:stun.l.google.com:19302' },
  ];
  if (process.env.TURN_SERVER_URL) {
    const turn = {
      urls: process.env.TURN_SERVER_URL,
      username: process.env.TURN_USERNAME,
      credential: process.env.TURN_CREDENTIAL,
    };
    servers.push(turn);
  }
  res.json({ iceServers: servers });
});

app.use('/api/auth', authRoutes);
app.use('/api/messages', messageRoutes);
app.use('/api/upload', createUploadRoutes(io));
app.use('/api/friends', createFriendRoutes(io));

app.get('/', (req, res) => {
  res.json({ message: 'Chat API is running' });
});

socketHandler(io);

const PORT = process.env.PORT || 5000;

mongoose
  .connect(process.env.MONGO_URI)
  .then(() => {
    console.log('Connected to MongoDB');
    server.listen(PORT, () => console.log(`Server running on port ${PORT}`));
  })
  .catch((err) => {
    console.error('MongoDB connection error:', err.message);
    process.exit(1);
  });
