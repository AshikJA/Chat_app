const mongoose = require('mongoose');

const friendRequestSchema = new mongoose.Schema({
  from: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true },
  status: { type: String, enum: ['pending', 'accepted', 'rejected'], default: 'pending' },
  createdAt: { type: Date, default: Date.now },
}, { _id: false });

const userSchema = new mongoose.Schema({
  name: { type: String, required: true },
  email: { type: String, required: true, unique: true, lowercase: true },
  password: { type: String, required: true },
  userId: { type: String, unique: true },
  username: { type: String, unique: true, lowercase: true, trim: true },
  avatar: { type: String, default: '' },
  status: { type: String, enum: ['online', 'offline', 'away'], default: 'offline' },
  publicKey: { type: String, default: '' },
  friends: [{ type: mongoose.Schema.Types.ObjectId, ref: 'User' }],
  friendRequests: [friendRequestSchema],
  createdAt: { type: Date, default: Date.now },
});

userSchema.pre('save', async function (next) {
  if (this.isNew && !this.userId) {
    let id;
    let exists = true;
    while (exists) {
      const num = String(Math.floor(1000 + Math.random() * 9000));
      id = `WC#${num}`;
      exists = await mongoose.model('User').findOne({ userId: id });
    }
    this.userId = id;
  }
  next();
});

module.exports = mongoose.model('User', userSchema);
