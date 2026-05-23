const express = require('express');
const router = express.Router();
const { getRedisClient } = require('../config/redis');
const { getChannel } = require('../config/rabbitmq');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'cart-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      redis: 'disconnected',
      rabbitmq: 'disconnected'
    }
  };
  
  // Check Redis
  try {
    const redisClient = getRedisClient();
    if (redisClient && redisClient.isReady) {
      await redisClient.ping();
      health.services.redis = 'connected';
    }
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'degraded';
  }
  
  // Check RabbitMQ
  try {
    const channel = getChannel();
    if (channel && channel.connection) {
      health.services.rabbitmq = 'connected';
    }
  } catch (error) {
    health.services.rabbitmq = 'error';
    health.status = 'degraded';
  }
  
  const allHealthy = health.services.redis === 'connected';
  health.status = allHealthy ? 'healthy' : 'unhealthy';
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/ready', async (req, res) => {
  try {
    const redisClient = getRedisClient();
    const isReady = redisClient && redisClient.isReady;
    res.status(isReady ? 200 : 503).json({ ready: isReady });
  } catch (error) {
    res.status(503).json({ ready: false });
  }
});

router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

module.exports = router;