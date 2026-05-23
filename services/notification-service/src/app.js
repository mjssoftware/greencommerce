const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { initializeQueues } = require('./services/queue.service');
const { initializeSubscribers } = require('./events/subscribers');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/error-handler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3007;

// Security middleware
app.use(helmet());
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.',
});
app.use('/api', limiter);

// Routes
app.use('/api/v1/notifications', require('./routes/v1/notification.routes'));
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
    
    // Initialize queues
    await initializeQueues();
    
    // Initialize event subscribers
    await initializeSubscribers(channel);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Notification service running on port ${PORT}`);
      logger.info(`Environment: ${process.env.NODE_ENV}`);
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
});

startServer();

module.exports = app;