const express = require('express');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const { uploadImage } = require('../middleware/upload');
const cloudinary = require('../config/cloudinary');
const transporter = require('../config/nodemailer');

const router = express.Router();

const generateToken = (id) => {
  return jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });
};

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, username, publicKey } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ message: 'All fields are required' });
    }

    const existingUser = await User.findOne({ email });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    if (username) {
      const existingUsername = await User.findOne({ username: username.toLowerCase() });
      if (existingUsername) {
        return res.status(400).json({ message: 'Username already taken' });
      }
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    const user = await User.create({ name, email, password, username: username || undefined, publicKey: publicKey || '', verificationToken });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyLink = `${clientUrl}/verify-email?token=${verificationToken}`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Verify your email',
        html: `<p>Hi ${name},</p>
               <p>Click <a href="${verifyLink}">here</a> to verify your email address.</p>
               <p>Or paste this link: ${verifyLink}</p>`,
      });
    } catch {
      // email may fail silently if SMTP isn't configured
    }

    const token = generateToken(user._id);

    res.status(201).json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        status: user.status,
        isVerified: user.isVerified,
        publicKey: user.publicKey,
      },
      emailSent: true,
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findOne({ email }).select('+password');
    if (!user) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Invalid credentials' });
    }

    const token = generateToken(user._id);

    res.json({
      token,
      user: {
        id: user._id,
        userId: user.userId,
        name: user.name,
        email: user.email,
        username: user.username,
        avatar: user.avatar,
        status: user.status,
        isVerified: user.isVerified,
        publicKey: user.publicKey,
      },
    });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/verify-email', async (req, res) => {
  try {
    const { token } = req.body;

    if (!token) {
      return res.status(400).json({ message: 'Verification token is required' });
    }

    const user = await User.findOne({ verificationToken: token });
    if (!user) {
      return res.status(400).json({ message: 'Invalid or expired verification token' });
    }

    user.isVerified = true;
    user.verificationToken = null;
    await user.save();

    res.json({ message: 'Email verified successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/resend-verification', auth, async (req, res) => {
  try {
    if (req.user.isVerified) {
      return res.json({ message: 'Email already verified' });
    }

    const verificationToken = crypto.randomBytes(32).toString('hex');
    await User.findByIdAndUpdate(req.user._id, { verificationToken });

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyLink = `${clientUrl}/verify-email?token=${verificationToken}`;

    await transporter.sendMail({
      from: process.env.SMTP_FROM,
      to: req.user.email,
      subject: 'Verify your email',
      html: `<p>Hi ${req.user.name},</p>
             <p>Click <a href="${verifyLink}">here</a> to verify your email address.</p>
             <p>Or paste this link: ${verifyLink}</p>`,
    });

    res.json({ message: 'Verification email sent' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/me', auth, async (req, res) => {
  res.json({ user: req.user });
});

router.put('/public-key', auth, async (req, res) => {
  try {
    const { publicKey } = req.body;
    if (!publicKey) {
      return res.status(400).json({ message: 'publicKey is required' });
    }
    await User.findByIdAndUpdate(req.user._id, { publicKey });
    res.json({ publicKey });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/update-profile', auth, async (req, res) => {
  try {
    const { name, avatar } = req.body;
    const updates = {};
    if (name) updates.name = name;
    if (avatar !== undefined) updates.avatar = avatar;

    if (!Object.keys(updates).length) {
      return res.status(400).json({ message: 'Nothing to update' });
    }

    const user = await User.findByIdAndUpdate(req.user._id, updates, { new: true, runValidators: true });
    res.json({ user });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/change-password', auth, async (req, res) => {
  try {
    const { currentPassword, newPassword } = req.body;

    if (!currentPassword || !newPassword) {
      return res.status(400).json({ message: 'Current password and new password are required' });
    }

    if (newPassword.length < 6) {
      return res.status(400).json({ message: 'New password must be at least 6 characters' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(currentPassword);
    if (!isMatch) {
      return res.status(401).json({ message: 'Current password is incorrect' });
    }

    user.password = newPassword;
    await user.save();

    res.json({ message: 'Password changed successfully' });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.put('/change-email', auth, async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ message: 'Email and password are required' });
    }

    const user = await User.findById(req.user._id).select('+password');
    const isMatch = await user.comparePassword(password);
    if (!isMatch) {
      return res.status(401).json({ message: 'Password is incorrect' });
    }

    const existingUser = await User.findOne({ email, _id: { $ne: req.user._id } });
    if (existingUser) {
      return res.status(400).json({ message: 'Email already in use' });
    }

    user.email = email;
    user.isVerified = false;
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.verificationToken = verificationToken;
    await user.save();

    const clientUrl = process.env.CLIENT_URL || 'http://localhost:5173';
    const verifyLink = `${clientUrl}/verify-email?token=${verificationToken}`;

    try {
      await transporter.sendMail({
        from: process.env.SMTP_FROM,
        to: email,
        subject: 'Verify your new email',
        html: `<p>Hi ${user.name},</p>
               <p>Click <a href="${verifyLink}">here</a> to verify your new email address.</p>
               <p>Or paste this link: ${verifyLink}</p>`,
      });
    } catch {
      // email may fail silently
    }

    res.json({ message: 'Email updated. Verification email sent.', user: { id: user._id, name: user.name, email: user.email, avatar: user.avatar, status: user.status, isVerified: user.isVerified } });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.post('/upload-avatar', auth, uploadImage.single('avatar'), async (req, res) => {
  try {
    if (!req.file) {
      return res.status(400).json({ message: 'No file provided' });
    }

    const result = await new Promise((resolve, reject) => {
      const stream = cloudinary.uploader.upload_stream(
        { folder: 'chat/avatars', resource_type: 'image' },
        (error, result) => {
          if (error) reject(error);
          else resolve(result);
        }
      );
      stream.end(req.file.buffer);
    });

    req.user.avatar = result.secure_url;
    await req.user.save();

    res.json({ avatar: result.secure_url });
  } catch (error) {
    res.status(500).json({ message: error.message });
  }
});

router.get('/users', auth, async (req, res) => {
  const users = await User.find({ _id: { $ne: req.user._id } }).select('userId username name email avatar status isVerified publicKey lastSeen');
  res.json({ users });
});

module.exports = router;
