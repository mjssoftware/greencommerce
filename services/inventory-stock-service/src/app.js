const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { initializeEventPublishers } = require('./events/publishers/inventory-event.publisher');
const { initializeSubscribers } = require('./events/subscribers');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/error-handler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3005;

// Security middleware
app.use(helmet());
app.use(compression());
app.use(cors({
  origin: process.env.API_GATEWAY_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Routes
app.use(`/api/${process.env.API_VERSION || 'v1'}/inventory`, require('./routes/v1/inventory.routes'));
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
      logger.info(`Inventory service running on port ${PORT}`);
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