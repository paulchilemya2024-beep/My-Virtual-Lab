// Loads environment variables once and exposes them as a typed-ish config object.
// Keeping this in one place means the rest of the code never reads process.env directly.
require('dotenv').config();

const config = {
  port: process.env.PORT || 5000,
  mongoUri: process.env.MONGODB_URI || 'mongodb://127.0.0.1:27017/stem-lab',
  jwtSecret: process.env.JWT_SECRET || 'dev-only-insecure-secret-change-me',
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '7d',
  gemini: {
    apiKey: process.env.GEMINI_API_KEY || '',
    model: process.env.GEMINI_MODEL || 'gemini-1.5-flash',
  },
  clientOrigins: (process.env.CLIENT_ORIGINS || 'http://localhost:5173')
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean),
  isProduction: process.env.NODE_ENV === 'production',
};

// A loud warning in production if the secret was never set — easy mistake to make.
if (config.isProduction && config.jwtSecret === 'dev-only-insecure-secret-change-me') {
  console.warn('⚠️  JWT_SECRET is not set in production. Set it in your environment!');
}

module.exports = config;
