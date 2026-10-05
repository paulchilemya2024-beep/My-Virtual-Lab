// Loads environment variables once and exposes them as a typed-ish config object.
// Keeping this in one place means the rest of the code never reads process.env directly.
require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stem-lab',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173,http://localhost:3003')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',

  // The AI tutor (server/src/routes/tutor.js) is entirely optional — with no
  // key set, the route replies with a clean "not configured" error instead of
  // crashing, so the rest of the app works the same with or without it.
  geminiApiKey: process.env.GEMINI_API_KEY || '',
  // A free-tier "flash-lite" model — cheapest/fastest Gemini tier, good
  // daily quota, no card on file. Verified directly against the live
  // ListModels endpoint for this key (Google renames/retires these model IDs
  // more often than the blog posts about them get updated — if this ever
  // 404s again, query https://generativelanguage.googleapis.com/v1beta/models
  // with your key to see the current real names rather than guessing).
  geminiModel: process.env.GEMINI_MODEL || 'gemini-3.5-flash-lite',
  // Hard daily safety cap, kept comfortably under Gemini's free-tier limit so
  // a traffic spike degrades to a friendly message instead of silently
  // exhausting the whole account's free quota for the rest of the day.
  tutorDailyBudget: Number(process.env.TUTOR_DAILY_BUDGET) || 1400,
};

// A loud warning in production if the secret was never set — easy mistake to make.
if (config.isProduction && config.jwtSecret === 'dev-only-insecure-secret-change-me') {
  console.warn('⚠️  JWT_SECRET is not set in production. Set it in your environment!');
}

module.exports = config;
