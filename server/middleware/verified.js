const requireVerified = (req, res, next) => {
  if (!req.user.isVerified) {
    return res.status(403).json({ message: 'Email verification required' });
  }
  next();
};

module.exports = requireVerified;
