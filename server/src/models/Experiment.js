const mongoose = require('mongoose');

// One step the student follows during an experiment.
const stepSchema = new mongoose.Schema(
  {
    stepNumber: { type: Number, required: true },
    instruction: { type: String, required: true },
    hint: { type: String, default: '' },
  },
  { _id: false }
);

// An experiment definition. The _id is a human-readable slug (e.g. "titration")
// so the frontend URL /labs/titration maps directly to this document.
const experimentSchema = new mongoose.Schema(
  {
    _id: { type: String }, // slug, e.g. "titration"
    title: { type: String, required: true },
    subject: {
      type: String,
      enum: ['chemistry', 'physics', 'biology', 'mathematics'],
      required: true,
    },
    difficulty: { type: Number, min: 1, max: 5, default: 1 },
    description: { type: String, default: '' },
    estimatedTime: { type: Number, default: 20 }, // minutes
    icon: { type: String, default: '' }, // optional emoji shown on the lab card
    availableChemicals: { type: [String], default: [] },
    availableVariables: { type: [String], default: [] },
    // Reaction database — free-form object keyed by "A + B". See data/experiments.json.
    reactions: { type: mongoose.Schema.Types.Mixed, default: {} },
    steps: { type: [stepSchema], default: [] },
    learningObjectives: { type: [String], default: [] },
    // e.g. { finalPH: { min: 6.8, max: 7.2 } }
    successCriteria: { type: mongoose.Schema.Types.Mixed, default: {} },
  },
  { timestamps: true, _id: false }
);

module.exports = mongoose.model('Experiment', experimentSchema);
