const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Protects routes: requires "Authorization: Bearer <token>"
const protect = async (req, res, next) => {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ success: false, message: 'Not authorized, no token' });
  }
  try {
    const decoded = jwt.verify(header.split(' ')[1], process.env.JWT_SECRET);
    req.user = await User.findById(decoded.id);
    if (!req.user) {
      return res.status(401).json({ success: false, message: 'User no longer exists' });
    }
    next();
  } catch (error) {
    res.status(401).json({ success: false, message: 'Not authorized, invalid or expired token' });
  }
};

module.exports = { protect };