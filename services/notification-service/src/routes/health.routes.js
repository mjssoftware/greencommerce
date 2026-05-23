const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const { getChannel } = require('../config/rabbitmq');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date(),
    uptime: process.uptime(),
    services: {
      mongodb: false,
      redis: false,
      rabbitmq: false,
    },
  };
  
  try {
    // Check MongoDB
    if (mongoose.connection.readyState === 1) {
      health.services.mongodb = true;
    }
    
    // Check Redis
    const redisClient = getRedisClient();
    if (redisClient && redisClient.isReady) {
      await redisClient.ping();
      health.services.redis = true;
    }
    
    // Check RabbitMQ
    const channel = getChannel();
    if (channel && !channel.connection.close) {
      health.services.rabbitmq = true;
    }
    
    const allHealthy = Object.values(health.services).every(Boolean);
    health.status = allHealthy ? 'healthy' : 'degraded';
    
    const statusCode = allHealthy ? 200 : 503;
    res.status(statusCode).json(health);
  } catch (error) {
    logger.error('Health check failed:', error);
    health.status = 'unhealthy';
    health.error = error.message;
    res.status(503).json(health);
  }
});

module.exports = router;