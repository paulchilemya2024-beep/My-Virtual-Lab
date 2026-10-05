const express = require('express');
const Session = require('../models/Session');
const Progress = require('../models/Progress');
const Experiment = require('../models/Experiment');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');
const {
  calculateScore,
  calculateXP,
  rankForXP,
  rankProgress,
  evaluateNewBadges,
  badgeCatalog,
} = require('../utils/gamification');

const router = express.Router();

// POST /api/progress/session
// Saves a completed (or abandoned) experiment session, then updates the user's
// rolled-up Progress: XP, rank, completion count, and any newly earned badges.
//
// Body: {
//   experimentId, stepsCompleted, totalSteps, mistakes: [{step, action}],
//   aiConversation: [{role, message}], startedAt, completedAt,
//   volumeOvershot, precisionAchieved, finalPH
// }
router.post(
  '/session',
  requireAuth,
  asyncHandler(async (req, res) => {
    const {
      experimentId,
      stepsCompleted = 0,
      totalSteps = 0,
      mistakes = [],
      aiConversation = [],
      startedAt,
      completedAt,
      volumeOvershot = 0,
      precisionAchieved = false,
    } = req.body;

    if (!experimentId) return res.status(400).json({ error: 'experimentId is required.' });

    const experiment = await Experiment.findById(experimentId).lean();
    if (!experiment) return res.status(404).json({ error: 'Experiment not found.' });

    const completed = Boolean(completedAt) || (totalSteps > 0 && stepsCompleted >= totalSteps);
    const mistakeCount = Array.isArray(mistakes) ? mistakes.length : 0;

    const score = calculateScore({ mistakeCount, volumeOvershot });
    const xpEarned = calculateXP({ completed, mistakeCount, score });

    const session = await Session.create({
      userId: req.user._id,
      experimentId,
      startedAt: startedAt || undefined,
      completedAt: completedAt || (completed ? new Date() : undefined),
      stepsCompleted,
      totalSteps,
      mistakes,
      score,
      xpEarned,
      aiConversation,
    });

    // ---- Update the rolled-up Progress document ----
    const progress = await Progress.findOne({ userId: req.user._id })
      || (await Progress.create({ userId: req.user._id }));

    if (completed) {
      progress.totalXP += xpEarned;
      progress.experimentsCompleted += 1;
      if (!progress.subjectsCompleted.includes(experiment.subject)) {
        progress.subjectsCompleted.push(experiment.subject);
      }
    }
    progress.rank = rankForXP(progress.totalXP);
    progress.lastActive = new Date();

    // Tally how many questions the student actually asked the AI tutor this
    // session (not its replies) toward the lifetime count the "great
    // questions" badge checks. aiConversation was always accepted and saved
    // here — this is the one line that was missing to make that badge real.
    const studentTurns = Array.isArray(aiConversation)
      ? aiConversation.filter((turn) => turn?.role === 'student').length
      : 0;
    progress.questionsAsked = (progress.questionsAsked || 0) + studentTurns;

    // Work out which new badges were earned with this session.
    const durationMinutes =
      session.completedAt && session.startedAt
        ? (session.completedAt - session.startedAt) / 60000
        : null;

    const newBadges = evaluateNewBadges({
      session,
      progress,
      durationMinutes,
      precisionAchieved,
    });
    if (newBadges.length) progress.badges.push(...newBadges);

    await progress.save();

    res.status(201).json({
      session: {
        id: session._id,
        experimentId: session.experimentId,
        score: session.score,
        xpEarned: session.xpEarned,
        stepsCompleted: session.stepsCompleted,
        totalSteps: session.totalSteps,
        completedAt: session.completedAt,
      },
      newBadges,
      progress: {
        totalXP: progress.totalXP,
        rank: progress.rank,
        experimentsCompleted: progress.experimentsCompleted,
        badges: progress.badges,
        ...rankProgress(progress.totalXP),
      },
    });
  })
);

// GET /api/progress/me — the logged-in user's rolled-up progress + recent sessions.
router.get(
  '/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const progress =
      (await Progress.findOne({ userId: req.user._id }).lean()) ||
      { totalXP: 0, rank: 'Curious Student', experimentsCompleted: 0, badges: [] };

    const recentSessions = await Session.find({ userId: req.user._id })
      .sort({ createdAt: -1 })
      .limit(10)
      .select('experimentId score xpEarned stepsCompleted totalSteps completedAt createdAt')
      .lean();

    res.json({
      progress: { ...progress, ...rankProgress(progress.totalXP || 0) },
      recentSessions,
    });
  })
);

// GET /api/progress/badges/me — the logged-in user's badges, with metadata.
router.get(
  '/badges/me',
  requireAuth,
  asyncHandler(async (req, res) => {
    const progress = await Progress.findOne({ userId: req.user._id }).lean();
    const earned = new Set(progress ? progress.badges : []);
    const badges = badgeCatalog().map((b) => ({ ...b, earned: earned.has(b.id) }));
    res.json({ badges });
  })
);

// GET /api/progress/:userId — a user's session history, PAGINATED.
// Never return an unbounded list: a power user could have thousands of sessions,
// and sending them all would blow up memory and response time. We cap page size
// and use skip/limit against the { userId, createdAt } index.
router.get(
  '/:userId',
  requireAuth,
  asyncHandler(async (req, res) => {
    const page = Math.max(1, parseInt(req.query.page, 10) || 1);
    const limit = Math.min(50, Math.max(1, parseInt(req.query.limit, 10) || 20));
    const skip = (page - 1) * limit;

    const [sessions, total] = await Promise.all([
      Session.find({ userId: req.params.userId })
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .lean(),
      Session.countDocuments({ userId: req.params.userId }),
    ]);

    res.json({
      sessions,
      pagination: { page, limit, total, totalPages: Math.ceil(total / limit) },
    });
  })
);

module.exports = router;
