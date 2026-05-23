const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const session = require('express-session');
const RedisStore = require('connect-redis')(session);
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { connectRedis, getRedisClient } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { initializeEventPublishers } = require('./events/publishers');
const { initializeSubscribers } = require('./events/subscribers');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/error-handler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3001;

// Security middleware
app.use(helmet({
  contentSecurityPolicy: false,
  crossOriginEmbedderPolicy: false,
}));

// CORS configuration
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:3000',
  credentials: true,
  optionsSuccessStatus: 200
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
});
app.use('/api', limiter);

// Session configuration
app.use(session({
  store: new RedisStore({ client: getRedisClient() }),
  secret: process.env.SESSION_SECRET,
  resave: false,
  saveUninitialized: false,
  cookie: {
    secure: process.env.NODE_ENV === 'production',
    httpOnly: true,
    maxAge: parseInt(process.env.SESSION_TTL) || 86400000,
    sameSite: 'strict'
  }
}));

// Routes
app.use(`/api/${process.env.API_VERSION || 'v1'}/auth`, require('./routes/v1/auth.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/users`, require('./routes/v1/user.routes'));
app.use('/health', require('./routes/health.routes'));

// Error handling
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
  try {
    // Connect to databases
    await connectDB();
    await connectRedis();
    
    // Connect to message broker
    const channel = await connectRabbitMQ();
    
    // Initialize event publishers and subscribers
    initializeEventPublishers(channel);
    await initializeSubscribers(channel);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Identity/Auth service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
      logger.info(`API Version: ${process.env.API_VERSION || 'v1'}`);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Graceful shutdown
process.on('SIGTERM', () => {
  logger.info('SIGTERM signal received: closing HTTP server');
  process.exit(0);
});

process.on('unhandledRejection', (error) => {
  logger.error('Unhandled Rejection:', error);
  process.exit(1);
});

process.on('uncaughtException', (error) => {
  logger.error('Uncaught Exception:', error);
  process.exit(1);
});

startServer();

module.exports = app;