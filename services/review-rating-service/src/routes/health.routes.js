const express = require('express');
const router = express.Router();
const mongoose = require('mongoose');
const { getChannel } = require('../config/rabbitmq');
const logger = require('../utils/logger');

router.get('/', async (req, res) => {
  const health = {
    status: 'healthy',
    service: 'review-service',
    version: '1.0.0',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    services: {
      mongodb: 'disconnected',
      rabbitmq: 'disconnected'
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
  
  const criticalServices = ['mongodb', 'rabbitmq'];
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