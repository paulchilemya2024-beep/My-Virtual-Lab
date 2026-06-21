const config = require('./config/env');
const connectDB = require('./config/db');
const createApp = require('./app');

// Entry point: connect to MongoDB, then start the HTTP server.
async function start() {
  await connectDB();

  const app = createApp();
  app.listen(config.port, () => {
    console.log(`🚀 STEM Lab API running on http://localhost:${config.port}`);
    console.log(`   AI tutor: ${config.gemini.apiKey ? 'Gemini enabled' : 'fallback mode (no GEMINI_API_KEY)'}`);
  });
}

start();
