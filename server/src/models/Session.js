const mongoose = require('mongoose');

const mistakeSchema = new mongoose.Schema(
  {
    step: { type: Number },
    action: { type: String },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

const conversationTurnSchema = new mongoose.Schema(
  {
    role: { type: String, enum: ['tutor', 'student'], required: true },
    message: { type: String, required: true },
    timestamp: { type: Date, default: Date.now },
  },
  { _id: false }
);

// One attempt at an experiment by one user.
const sessionSchema = new mongoose.Schema(
  {
    userId: { type: mongoose.Schema.Types.ObjectId, ref: 'User', required: true, index: true },
    experimentId: { type: String, ref: 'Experiment', required: true },
    startedAt: { type: Date, default: Date.now },
    completedAt: { type: Date },
    stepsCompleted: { type: Number, default: 0 },
    totalSteps: { type: Number, default: 0 },
    mistakes: { type: [mistakeSchema], default: [] },
    score: { type: Number, default: 0 },
    xpEarned: { type: Number, default: 0 },
    aiConversation: { type: [conversationTurnSchema], default: [] },
  },
  { timestamps: true }
);

// Compound index: nearly every session query is "this user's sessions, newest
// first" (dashboard, history). Indexing { userId, createdAt } turns those from a
// full-collection scan into an O(log n) index seek — essential once the Sessions
// collection holds tens of millions of rows.
sessionSchema.index({ userId: 1, createdAt: -1 });

module.exports = mongoose.model('Session', sessionSchema);
