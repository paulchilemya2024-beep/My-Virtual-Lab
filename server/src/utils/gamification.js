// All XP / rank / badge / scoring rules live here, matching Sections 14 & 17
// of the System Design document. Keeping them in one file makes the rules easy
// to tweak without touching route logic.

// Section 17 — Rank progression by total XP.
const RANKS = [
  { min: 0, max: 99, name: 'Curious Student' },
  { min: 100, max: 299, name: 'Lab Technician' },
  { min: 300, max: 599, name: 'Junior Scientist' },
  { min: 600, max: 999, name: 'Chemist / Physicist' },
  { min: 1000, max: Infinity, name: 'Professor' },
];

function rankForXP(totalXP) {
  const match = RANKS.find((r) => totalXP >= r.min && totalXP <= r.max);
  return match ? match.name : 'Curious Student';
}

// Returns { current, next, xpIntoLevel, xpForLevel, percentToNext } for UI XP bars.
function rankProgress(totalXP) {
  const index = RANKS.findIndex((r) => totalXP >= r.min && totalXP <= r.max);
  const current = RANKS[index] || RANKS[0];
  const next = RANKS[index + 1] || null;

  if (!next) {
    return { current: current.name, next: null, xpIntoLevel: 0, xpForLevel: 0, percentToNext: 100 };
  }

  const xpIntoLevel = totalXP - current.min;
  const xpForLevel = next.min - current.min;
  const percentToNext = Math.min(100, Math.round((xpIntoLevel / xpForLevel) * 100));

  return { current: current.name, next: next.name, xpIntoLevel, xpForLevel, percentToNext };
}

// Section 14 — Score = 100 - (mistakes * 10) - (volumeOvershot * 2), clamped 0–100.
function calculateScore({ mistakeCount = 0, volumeOvershot = 0 } = {}) {
  const raw = 100 - mistakeCount * 10 - volumeOvershot * 2;
  return Math.max(0, Math.min(100, Math.round(raw)));
}

// Section 17 — XP earned for one completed session.
function calculateXP({ completed = true, mistakeCount = 0, score = 0 } = {}) {
  if (!completed) return 0;
  let xp = 50; // base for completing an experiment
  if (mistakeCount === 0) xp += 25; // "no mistakes" bonus
  if (score === 100) xp += 10; // perfect-score nudge
  return xp;
}

// Section 17 — Badge definitions. Each has an `earned(ctx)` predicate.
// ctx contains the freshly-saved session plus the user's updated progress.
const BADGES = [
  {
    id: 'first-experiment',
    label: 'First Experiment',
    icon: '🏅',
    description: 'Complete your first lab',
    earned: (ctx) => ctx.progress.experimentsCompleted >= 1,
  },
  {
    id: 'perfect-score',
    label: 'Perfect Score',
    icon: '⭐',
    description: 'Score 100/100',
    earned: (ctx) => ctx.session.score === 100,
  },
  {
    id: 'no-mistakes',
    label: 'No Mistakes',
    icon: '🔬',
    description: 'Complete a lab with zero errors',
    earned: (ctx) => ctx.session.mistakes.length === 0 && ctx.session.completedAt,
  },
  {
    id: 'speed-scientist',
    label: 'Speed Scientist',
    icon: '⚡',
    description: 'Complete a lab in under 10 minutes',
    earned: (ctx) => ctx.durationMinutes != null && ctx.durationMinutes < 10,
  },
  {
    id: 'explorer',
    label: 'Explorer',
    icon: '🌍',
    description: 'Complete an experiment in each subject',
    earned: (ctx) =>
      ['chemistry', 'physics', 'biology'].every((s) => ctx.progress.subjectsCompleted.includes(s)),
  },
  {
    id: 'great-questions',
    label: 'Great Questions',
    icon: '💬',
    description: 'Ask the AI tutor 20 questions total',
    earned: (ctx) => ctx.progress.questionsAsked >= 20,
  },
  {
    id: 'precision',
    label: 'Precision',
    icon: '🎯',
    description: 'Get within 0.1 pH of the correct endpoint',
    earned: (ctx) => ctx.precisionAchieved === true,
  },
  {
    id: 'lab-champion',
    label: 'Lab Champion',
    icon: '🏆',
    description: 'Earn 1000 XP',
    earned: (ctx) => ctx.progress.totalXP >= 1000,
  },
];

// Returns the list of badge ids the user newly qualifies for (not already owned).
function evaluateNewBadges(ctx) {
  const owned = new Set(ctx.progress.badges);
  return BADGES.filter((b) => !owned.has(b.id) && safeEarned(b, ctx)).map((b) => b.id);
}

function safeEarned(badge, ctx) {
  try {
    return Boolean(badge.earned(ctx));
  } catch {
    return false;
  }
}

// Public metadata for the UI (so the frontend can render icons + descriptions).
function badgeCatalog() {
  return BADGES.map(({ id, label, icon, description }) => ({ id, label, icon, description }));
}

module.exports = {
  RANKS,
  rankForXP,
  rankProgress,
  calculateScore,
  calculateXP,
  evaluateNewBadges,
  badgeCatalog,
};
