const express = require('express');
const rateLimit = require('express-rate-limit');
const Experiment = require('../models/Experiment');
const config = require('../config/env');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const { askTutor, budgetStatus } = require('../utils/tutor');

const router = express.Router();

// Per-user throttle, separate from the auth limiter — tutoring is bursty
// (several exchanges in a couple of minutes while working through a step)
// but should never become a way to hammer a metered external API. 20 asks
// per 10 minutes is generous for a real session and cheap to raise later.
// Mounted after requireAuth (below), so req.user is always set by the time
// this runs — requireAuth already rejects anything unauthenticated with a
// 401 before the request ever reaches here. Keying on the user id rather
// than req.ip also means a whole school behind one NAT'd IP doesn't share
// one rate-limit bucket.
const tutorLimiter = rateLimit({
  windowMs: 10 * 60 * 1000,
  max: 20,
  standardHeaders: true,
  legacyHeaders: false,
  keyGenerator: (req) => req.user._id.toString(),
  message: { error: 'You have asked the tutor a lot of questions — give it a few minutes and try again.' },
});

// POST /api/tutor/ask
// Body: { experimentId, trigger: 'goal'|'mistake'|'idle'|'question', context: { label? , question? }, history?: [{role,message}] }
// The frontend never sends raw simulation state — only the small, already
// human-readable piece of context relevant to this one trigger (a goal's
// label, a mistake's description, or the student's own typed words).
router.post(
  '/ask',
  requireAuth,
  tutorLimiter,
  asyncHandler(async (req, res) => {
    const { experimentId, trigger = 'question', context = {}, history = [] } = req.body;
    if (!experimentId) return res.status(400).json({ error: 'experimentId is required.' });

    const experiment = await Experiment.findById(experimentId).lean();
    if (!experiment) return res.status(404).json({ error: 'Experiment not found.' });

    try {
      const reply = await askTutor({ experiment, trigger, context, history });
      res.json({ reply });
    } catch (err) {
      res.status(err.status || 500).json({ error: err.message });
    }
  })
);

// GET /api/tutor/status — lets the frontend check once (e.g. on lab load)
// whether the tutor is configured and how much of today's free budget is
// left, so it can hide the tutor UI cleanly instead of erroring on first ask.
router.get('/status', (req, res) => {
  res.json({ enabled: Boolean(config.geminiApiKey), budget: budgetStatus() });
});

module.exports = router;
