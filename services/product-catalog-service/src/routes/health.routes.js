const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getRedisClient } = require('../config/redis');
const { getChannel } = require('../config/rabbitmq');
const { getEsClient } = require('../config/elasticsearch');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'product-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: 'disconnected',
      redis: 'disconnected',
      rabbitmq: 'disconnected',
      elasticsearch: 'disconnected'
    }
  };
  
  // Check MongoDB
  try {
    if (mongoose.connection.readyState === 1) {
      await mongoose.connection.db.admin().ping();
      health.services.mongodb = 'connected';
    }
  } catch (error) {
    health.services.mongodb = 'error';
    health.status = 'degraded';
  }
  
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
  
  // Check Elasticsearch
  try {
    const esClient = getEsClient();
    if (esClient) {
      await esClient.cluster.health();
      health.services.elasticsearch = 'connected';
    }
  } catch (error) {
    health.services.elasticsearch = 'disconnected';
    // Don't degrade status for Elasticsearch - it's optional
  }
  
  const criticalServices = ['mongodb', 'redis', 'rabbitmq'];
  const allHealthy = criticalServices.every(s => health.services[s] === 'connected');
  health.status = allHealthy ? 'healthy' : 'unhealthy';
  
  const statusCode = health.status === 'healthy' ? 200 : 503;
  res.status(statusCode).json(health);
});

router.get('/ready', async (req, res) => {
  const isReady = mongoose.connection.readyState === 1;
  res.status(isReady ? 200 : 503).json({ ready: isReady });
});

router.get('/live', (req, res) => {
  res.status(200).json({ alive: true });
});

module.exports = router;