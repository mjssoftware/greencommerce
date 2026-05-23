const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const { getChannel } = require('../config/rabbitmq');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'auth-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: 'disconnected',
      redis: 'disconnected',
      rabbitmq: 'disconnected'
    }
  };
  
  // Check MongoDB
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      health.services.mongodb = 'connected';
    } else {
      health.services.mongodb = 'disconnected';
    }
  } catch (error) {
    health.services.mongodb = 'error';
    health.status = 'degraded';
    logger.error('MongoDB health check failed:', error);
  }
  
  // Check Redis
  try {
    const redisClient = getRedisClient();
    if (redisClient && redisClient.isReady) {
      await redisClient.ping();
      health.services.redis = 'connected';
    } else {
      health.services.redis = 'disconnected';
    }
  } catch (error) {
    health.services.redis = 'error';
    health.status = 'degraded';
    logger.error('Redis health check failed:', error);
  }
  
  // Check RabbitMQ
  try {
    const channel = getChannel();
    if (channel && channel.connection) {
      health.services.rabbitmq = 'connected';
    } else {
      health.services.rabbitmq = 'disconnected';
    }
  } catch (error) {
    health.services.rabbitmq = 'error';
    health.status = 'degraded';
    logger.error('RabbitMQ health check failed:', error);
  }
  
  const allHealthy = Object.values(health.services).every(s => s === 'connected');
  if (!allHealthy) health.status = 'unhealthy';
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/ready', async (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  if (isReady) {
    res.status(200).json({ ready: true });
  } else {
    res.status(503).json({ ready: false });
  }
});

router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

module.exports = router;