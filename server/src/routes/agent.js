const express = require('express');
const Experiment = require('../models/Experiment');
const Progress = require('../models/Progress');
const { askTutor } = require('../agent/tutor');
const { requireAuth } = require('../middleware/auth');
const asyncHandler = require('../middleware/asyncHandler');

const router = express.Router();

// POST /api/agent/ask
// Body: {
//   experimentId, studentLevel, currentStep, chemicals, temperature,
//   lastAction, reactionResult, question
// }
// Sends the live experiment context to the AI tutor and returns its reply.
router.post(
  '/ask',
  requireAuth,
  asyncHandler(async (req, res) => {
    const { experimentId, studentLevel = 'beginner', question, ...rest } = req.body;

    if (!experimentId) return res.status(400).json({ error: 'experimentId is required.' });

    const experiment = await Experiment.findById(experimentId).lean();
    if (!experiment) return res.status(404).json({ error: 'Experiment not found.' });

    // Everything else in the body is treated as live experiment context.
    const experimentContext = {
      currentStep: rest.currentStep,
      chemicals: rest.chemicals,
      temperature: rest.temperature,
      currentPH: rest.currentPH ?? rest.ph,
      lastAction: rest.lastAction,
      reactionResult: rest.reactionResult,
      ...rest.context, // allow an explicit nested context object too
    };

    const { reply, source } = await askTutor({
      experiment,
      studentLevel,
      experimentContext,
      question,
    });

    // Count real student questions toward the "Great Questions" badge.
    if (question && question.trim()) {
      await Progress.updateOne({ userId: req.user._id }, { $inc: { questionsAsked: 1 } });
    }

    res.json({ reply, source });
  })
);

module.exports = router;
