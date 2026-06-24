/**
 * PJ Music App — Main Server Entry Point
 * Sets up Express, Socket.IO, MongoDB connection, and all middleware.
 */

require('dotenv').config();

const express = require('express');
const http = require('http');
const { Server } = require('socket.io');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const morgan = require('morgan');
const mongoSanitize = require('express-mongo-sanitize');
const xssClean = require('xss-clean');
const hpp = require('hpp');

const connectDB = require('./src/config/database');
const { apiLimiter, authLimiter } = require('./src/middleware/rateLimiter');
const errorHandler = require('./src/middleware/errorHandler');
const logger = require('./src/utils/logger');

// Route imports
const authRoutes = require('./src/routes/auth');
const userRoutes = require('./src/routes/user');
const songRoutes = require('./src/routes/song');
const playlistRoutes = require('./src/routes/playlist');
const friendRoutes = require('./src/routes/friend');
const roomRoutes = require('./src/routes/room');

// Socket.IO handler
const { initSocket } = require('./src/socket/index');

const app = express();
const server = http.createServer(app);

// ─── Socket.IO setup ─────────────────────────────────────────────────────────
const io = new Server(server, {
  cors: {
    origin: process.env.ALLOWED_ORIGINS
      ? process.env.ALLOWED_ORIGINS.split(',')
      : '*',          // ← development mein sab allow
    methods: ['GET', 'POST'],
    credentials: process.env.ALLOWED_ORIGINS ? true : false,
  },
  pingTimeout: 60000,
  pingInterval: 25000,
});

// Attach io instance to app for use in controllers
app.set('io', io);
initSocket(io);

// ─── Database connection ─────────────────────────────────────────────────────
connectDB();

// ─── Security middleware ─────────────────────────────────────────────────────
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'"],
      styleSrc: ["'self'", "'unsafe-inline'"],
      imgSrc: ["'self'", 'data:', 'blob:'],
    },
  },
  crossOriginEmbedderPolicy: false,
}));

// CORS — production mein ALLOWED_ORIGINS set karo, dev mein sab allow
app.use(cors({
  origin: process.env.ALLOWED_ORIGINS
    ? process.env.ALLOWED_ORIGINS.split(',')
    : '*',
  credentials: process.env.ALLOWED_ORIGINS ? true : false,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

// Compression
app.use(compression());

// Request logging
if (process.env.NODE_ENV !== 'test') {
  app.use(morgan('combined', {
    stream: { write: (msg) => logger.info(msg.trim()) },
  }));
}

// Body parsing
app.use(express.json({ limit: '10kb' }));
app.use(express.urlencoded({ extended: true, limit: '10kb' }));

// NoSQL injection prevention (sanitize MongoDB queries)
app.use(mongoSanitize());

// XSS protection
app.use(xssClean());

// HTTP parameter pollution prevention
app.use(hpp());

// ─── Rate limiting ────────────────────────────────────────────────────────────
app.use('/api/', apiLimiter);
app.use('/api/auth/', authLimiter);

// ─── Routes ──────────────────────────────────────────────────────────────────
app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/songs', songRoutes);
app.use('/api/playlists', playlistRoutes);
app.use('/api/friends', friendRoutes);
app.use('/api/rooms', roomRoutes);

// Health check
app.get('/health', (req, res) => {
  res.status(200).json({ status: 'OK', timestamp: new Date().toISOString() });
});

// 404 handler
app.use('*', (req, res) => {
  res.status(404).json({ success: false, message: 'Route not found' });
});

// Global error handler (must be last)
app.use(errorHandler);

// ─── Start server ────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 5000;
server.listen(PORT, () => {
  logger.info(`PJ Music App server running on port ${PORT} [${process.env.NODE_ENV}]`);
});

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM received. Shutting down gracefully...');
  server.close(() => {
    logger.info('Server closed.');
    process.exit(0);
  });
});

module.exports = { app, server };
