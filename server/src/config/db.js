const mongoose = require('mongoose');
const config = require('./env');

// Connects to MongoDB Atlas (or a local MongoDB). Called once at startup.
async function connectDB() {
  mongoose.set('strictQuery', true);

  try {
    await mongoose.connect(config.mongoUri);
    console.log('✅ Connected to MongoDB');
  } catch (error) {
    console.error('❌ MongoDB connection failed:', error.message);
    // Without a database the API cannot serve real data, so stop the process.
    process.exit(1);
  }

  mongoose.connection.on('disconnected', () => {
    console.warn('⚠️  MongoDB disconnected');
  });
}

module.exports = connectDB;
