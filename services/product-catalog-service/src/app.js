const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const compression = require('compression');
const rateLimit = require('express-rate-limit');
const mongoSanitize = require('express-mongo-sanitize');
const dotenv = require('dotenv');
const path = require('path');
const { connectDB } = require('./config/database');
const { connectRedis } = require('./config/redis');
const { connectRabbitMQ } = require('./config/rabbitmq');
const { initializeElasticsearch } = require('./config/elasticsearch');
const { initializeEventPublishers } = require('./events/publishers/product-event.publisher');
const logger = require('./utils/logger');
const errorHandler = require('./middleware/error-handler');

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3002;

// Security middleware
app.use(helmet({
  crossOriginResourcePolicy: { policy: "cross-origin" }
}));

// Compression
app.use(compression());

// CORS configuration
app.use(cors({
  origin: process.env.API_GATEWAY_URL || 'http://localhost:3000',
  credentials: true
}));

// Body parsing
app.use(express.json({ limit: '10mb' }));
app.use(express.urlencoded({ extended: true, limit: '10mb' }));

// Data sanitization against NoSQL injection
app.use(mongoSanitize());

// Rate limiting
const limiter = rateLimit({
  windowMs: process.env.RATE_LIMIT_WINDOW_MS || 900000,
  max: process.env.RATE_LIMIT_MAX_REQUESTS || 100,
  message: 'Too many requests from this IP, please try again later.'
});
app.use('/api', limiter);

// Static files for uploaded images
app.use('/uploads', express.static(path.join(__dirname, '../uploads')));

// Routes
app.use(`/api/${process.env.API_VERSION || 'v1'}/products`, require('./routes/v1/product.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/categories`, require('./routes/v1/category.routes'));
app.use(`/api/${process.env.API_VERSION || 'v1'}/brands`, require('./routes/v1/brand.routes'));
app.use('/health', require('./routes/health.routes'));

// Error handling
app.use(errorHandler);

// Initialize services and start server
const startServer = async () => {
  try {
    // Connect to databases
    await connectDB();
    await connectRedis();
    
    // Connect to Elasticsearch
    await initializeElasticsearch();
    
    // Connect to message broker
    const channel = await connectRabbitMQ();
    
    // Initialize event publishers
    initializeEventPublishers(channel);
    
    // Start server
    app.listen(PORT, () => {
      logger.info(`Product catalog service running on port ${PORT}`);
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