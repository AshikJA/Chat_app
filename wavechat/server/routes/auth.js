const router = require('express').Router();
const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');
const User = require('../models/User');
const auth = require('../middleware/auth');
const transporter = require('../nodemailer.config');
const { setOtp, verifyOtp } = require('../otpStore');

const pendingRegistrations = new Map();

function generateOtp() {
  return String(Math.floor(100000 + Math.random() * 900000));
}

function sendOtpEmail(email, otp) {
  const html = `
<!DOCTYPE html>
<html>
<head>
  <meta charset="utf-8">
  <meta name="color-scheme" content="dark">
</head>
<body style="margin:0;padding:0;background-color:#0B0B10;font-family:'DM Sans','Segoe UI',sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background-color:#0B0B10;padding:40px 20px;">
    <tr>
      <td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background-color:#13131A;border-radius:16px;padding:48px 40px;border:1px solid #1E1E2A;">
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <span style="font-size:28px;font-weight:700;color:#8A6EFF;">WaveChat</span>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:8px;">
              <h1 style="margin:0;font-size:20px;font-weight:600;color:#F0F0F5;letter-spacing:-0.3px;">Verify your email</h1>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:32px;">
              <p style="margin:0;font-size:14px;color:#8A8A9E;line-height:1.6;">Use the code below to complete your registration. This code expires in 10 minutes.</p>
            </td>
          </tr>
          <tr>
            <td align="center" style="padding-bottom:40px;">
              <table role="presentation" cellpadding="0" cellspacing="0" style="background:#1A1A26;border-radius:12px;padding:20px 48px;border:1px solid #2A2A3A;">
                <tr>
                  <td>
                    <span style="font-size:36px;font-weight:700;letter-spacing:12px;color:#8A6EFF;font-family:'Courier New',monospace;">${otp}</span>
                  </td>
                </tr>
              </table>
            </td>
          </tr>
          <tr>
            <td align="center">
              <p style="margin:0;font-size:12px;color:#5A5A6E;">If you didn't request this code, you can safely ignore this email.</p>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  </table>
</body>
</html>`;

  return transporter.sendMail({
    from: `"WaveChat" <${process.env.EMAIL_USER}>`,
    to: email,
    subject: 'Your WaveChat verification code',
    html,
  });
}

router.post('/register', async (req, res) => {
  try {
    const { name, email, password, username } = req.body;

    if (!name || !email || !password) {
      return res.status(400).json({ error: 'Name, email, and password are required' });
    }

    const existing = await User.findOne({ $or: [{ email }, { username }] });
    if (existing) {
      return res.status(400).json({ error: 'Email or username already in use' });
    }

    const hashedPassword = await bcrypt.hash(password, 12);
    const otp = generateOtp();

    pendingRegistrations.set(email, { name, email, password: hashedPassword, username });
    setOtp(email, otp);

    await sendOtpEmail(email, otp);

    res.json({ message: 'OTP sent to email', email });
  } catch (err) {
    console.error('Register error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/verify-otp', async (req, res) => {
  try {
    const { email, otp } = req.body;

    if (!email || !otp) {
      return res.status(400).json({ error: 'Email and OTP are required' });
    }

    if (!verifyOtp(email, otp)) {
      return res.status(400).json({ error: 'Invalid or expired OTP' });
    }

    const pending = pendingRegistrations.get(email);
    if (!pending) {
      return res.status(400).json({ error: 'No pending registration found. Please register again.' });
    }

    const user = new User({
      name: pending.name,
      email: pending.email,
      password: pending.password,
      username: pending.username,
    });

    await user.save();
    pendingRegistrations.delete(email);

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      message: 'Email verified successfully',
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('Verify OTP error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await User.findOne({ email });
    if (!user) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const isMatch = await bcrypt.compare(password, user.password);
    if (!isMatch) {
      return res.status(400).json({ error: 'Invalid credentials' });
    }

    const token = jwt.sign({ id: user._id, email: user.email }, process.env.JWT_SECRET, { expiresIn: '7d' });

    res.json({
      token,
      user: {
        id: user._id,
        name: user.name,
        email: user.email,
        userId: user.userId,
        username: user.username,
        avatar: user.avatar,
        status: user.status,
      },
    });
  } catch (err) {
    console.error('Login error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', auth, async (req, res) => {
  try {
    const user = await User.findById(req.user.id).select('-password');
    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }
    res.json({ user });
  } catch (err) {
    console.error('Me error:', err);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
