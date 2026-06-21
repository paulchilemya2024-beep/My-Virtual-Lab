const express = require('express');
const User = require('../models/User');
const Progress = require('../models/Progress');
const { signToken } = require('../utils/token');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// Very small email/password sanity checks — enough for an MVP.
function validateCredentials({ email, password }) {
  if (!email || !/^\S+@\S+\.\S+$/.test(email)) return 'A valid email is required.';
  if (!password || password.length < 6) return 'Password must be at least 6 characters.';
  return null;
}

// POST /api/auth/register — create a new student account, return a token.
router.post(
  '/register',
  asyncHandler(async (req, res) => {
    const { name, email, password, grade, country } = req.body;

    const credError = validateCredentials({ email, password });
    if (credError) return res.status(400).json({ error: credError });
    if (!name || !name.trim()) return res.status(400).json({ error: 'Name is required.' });

    const existing = await User.findOne({ email: email.toLowerCase() });
    if (existing) return res.status(409).json({ error: 'An account with that email already exists.' });

    const user = new User({ name: name.trim(), email, grade, country });
    await user.setPassword(password);
    await user.save();

    // Every new user starts with an empty progress record.
    await Progress.create({ userId: user._id });

    const token = signToken(user);
    res.status(201).json({ token, user: user.toPublicJSON() });
  })
);

// POST /api/auth/login — verify credentials, return a token.
router.post(
  '/login',
  asyncHandler(async (req, res) => {
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'Email and password are required.' });

    const user = await User.findOne({ email: email.toLowerCase() });
    if (!user) return res.status(401).json({ error: 'Invalid email or password.' });

    const ok = await user.checkPassword(password);
    if (!ok) return res.status(401).json({ error: 'Invalid email or password.' });

    const token = signToken(user);
    res.json({ token, user: user.toPublicJSON() });
  })
);

// GET /api/auth/me — return the currently logged-in user.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    res.json({ user: req.user.toPublicJSON() });
  })
);

module.exports = router;
