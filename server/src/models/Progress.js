const mongoose = require('mongoose');

// A rolled-up summary of one user's lifetime progress.
// One Progress document per user; updated every time a session is saved.
const progressSchema = new mongoose.Schema(
  {
    userId: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
      index: true,
    },
    totalXP: { type: Number, default: 0 },
    rank: { type: String, default: 'Curious Student' },
    experimentsCompleted: { type: Number, default: 0 },
    badges: { type: [String], default: [] },
    // Subjects the student has completed at least one experiment in — used for the "Explorer" badge.
    subjectsCompleted: { type: [String], default: [] },
    questionsAsked: { type: Number, default: 0 },
    lastActive: { type: Date, default: Date.now },
  },
  { timestamps: true }
);

module.exports = mongoose.model('Progress', progressSchema);
