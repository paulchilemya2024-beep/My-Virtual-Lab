const express = require('express');
const cors = require('cors');
const morgan = require('morgan');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const config = require('./config/env');
const { notFound, errorHandler } = require('./middleware/errorHandler');
const { badgeCatalog } = require('./utils/gamification');

const authRoutes = require('./routes/auth');
const experimentRoutes = require('./routes/experiments');
const progressRoutes = require('./routes/progress');
const tutorRoutes = require('./routes/tutor');

// Builds the Express app (separated from server start so it can be tested).
function createApp() {
  const app = express();

  // --- Core middleware ---
  app.use(helmet());
  app.use(express.json());
  app.use(
    cors({
      origin(origin, callback) {
        // Allow tools with no origin (curl, mobile apps), any allow-listed origin,
        // and local dev origins from Vite/React on localhost or 127.0.0.1.
        const isLocalDevOrigin = /^https?:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin || '');
        if (!origin || config.clientOrigins.includes(origin) || isLocalDevOrigin) return callback(null, true);
        return callback(new Error(`Origin ${origin} not allowed by CORS`));
      },
      credentials: true,
    })
  );
  if (!config.isProduction) app.use(morgan('dev'));

  // Throttle login/register specifically — the routes credential-stuffing bots target.
  const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 20,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts. Please try again later.' },
  });
  app.use('/api/auth/register', authLimiter);
  app.use('/api/auth/login', authLimiter);

  // --- Health check (used by UptimeRobot to keep Render awake) ---
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok', time: new Date().toISOString() });
  });

  // Static metadata the frontend can render without auth.
  app.get('/api/badges', (req, res) => res.json({ badges: badgeCatalog() }));

  // --- Route groups (Section 6 of the design doc) ---
  app.use('/api/auth', authRoutes);
  app.use('/api/experiments', experimentRoutes);
  app.use('/api/progress', progressRoutes);
  app.use('/api/tutor', tutorRoutes);

  // --- Error handling (must come last) ---
  app.use(notFound);
  app.use(errorHandler);

  return app;
}

module.exports = createApp;
