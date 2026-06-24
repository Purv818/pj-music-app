/**
 * MongoDB connection configuration using Mongoose.
 * Handles connection, retry logic, and graceful shutdown.
 */

const mongoose = require('mongoose');
const logger = require('../utils/logger');

const connectDB = async () => {
  try {
    const conn = await mongoose.connect(process.env.MONGODB_URI, {
      // Security: avoid exposing connection details in logs
      serverSelectionTimeoutMS: 5000,
      socketTimeoutMS: 45000,
    });

    logger.info(`MongoDB connected: ${conn.connection.host}`);

    // Handle connection events
    mongoose.connection.on('error', (err) => {
      logger.error(`MongoDB connection error: ${err}`);
    });

    mongoose.connection.on('disconnected', () => {
      logger.warn('MongoDB disconnected. Attempting to reconnect...');
    });

    mongoose.connection.on('reconnected', () => {
      logger.info('MongoDB reconnected.');
    });

  } catch (error) {
    logger.error(`MongoDB connection failed: ${error.message}`);
    // Exit process so the container/pm2 can restart
    process.exit(1);
  }
};

// Graceful shutdown — close connection when app terminates
process.on('SIGINT', async () => {
  await mongoose.connection.close();
  logger.info('MongoDB connection closed on app termination.');
  process.exit(0);
});

module.exports = connectDB;
