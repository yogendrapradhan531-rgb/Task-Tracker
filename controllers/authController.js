
const jwt = require('jsonwebtoken');
const User = require('../models/User');

// Creates a signed token containing the user's id
const generateToken = (id) =>
  jwt.sign({ id }, process.env.JWT_SECRET, {
    expiresIn: process.env.JWT_EXPIRES_IN || '7d',
  });

const sendAuth = (res, status, user) =>
  res.status(status).json({
    success: true,
    token: generateToken(user._id),
    user: { id: user._id, username: user.username, email: user.email },
  });

// @route POST /api/auth/register
const register = async (req, res) => {
  try {
    const { username, email, password } = req.body;
    const user = await User.create({ username, email, password }); // password hashed by model hook
    sendAuth(res, 201, user);
  } catch (error) {
    if (error.code === 11000) {
      return res.status(400).json({ success: false, message: 'Email already registered' });
    }
    if (error.name === 'ValidationError') {
      const messages = Object.values(error.errors).map((e) => e.message);
      return res.status(400).json({ success: false, message: messages.join(', ') });
    }
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

// @route POST /api/auth/login
const login = async (req, res) => {
  try {
    const { email, password } = req.body;
    if (!email || !password) {
      return res.status(400).json({ success: false, message: 'Email and password are required' });
    }
    const user = await User.findOne({ email: email.toLowerCase().trim() }).select('+password');
    if (!user || !(await user.matchPassword(password))) {
      return res.status(401).json({ success: false, message: 'Invalid email or password' });
    }
    sendAuth(res, 200, user);
  } catch (error) {
    console.error(error);
    res.status(500).json({ success: false, message: 'Server error' });
  }
};

const handleError = require('../utils/handleError');
const publicUser = (u) => ({ id: u._id, username: u.username, email: u.email });

// GET /api/auth/me
const getMe = (req, res) => res.status(200).json({ success: true, user: publicUser(req.user) });

// PUT /api/auth/profile: change username and/or password
const updateProfile = async (req, res) => {
  try {
    const { username, currentPassword, newPassword } = req.body;
    const user = await User.findById(req.user._id).select('+password');
    if (username) user.username = username;
    if (newPassword) {
      if (!currentPassword || !(await user.matchPassword(currentPassword))) {
        return res.status(400).json({ success: false, message: 'Current password is incorrect' });
      }
      user.password = newPassword; // re-hashed by the model hook
    }
    await user.save();
    res.status(200).json({ success: true, user: publicUser(user) });
  } catch (e) { handleError(res, e); }
};

module.exports = { register, login, getMe, updateProfile };
