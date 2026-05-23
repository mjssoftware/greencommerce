const express = require('express');
const router = express.Router();
const notificationController = require('../../controllers/notification.controller');
const { validate } = require('../../middleware/validate');
const { authMiddleware } = require('../../middleware/auth');
const Joi = require('joi');

// Validation schemas
const createNotificationSchema = Joi.object({
  userId: Joi.string().required(),
  type: Joi.string().valid('email', 'sms', 'push', 'in_app').required(),
  channel: Joi.string().valid('order', 'payment', 'inventory', 'user', 'promotion').required(),
  title: Joi.string().required(),
  content: Joi.string().required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
  scheduledFor: Joi.date(),
});

const bulkNotificationSchema = Joi.object({
  userIds: Joi.array().items(Joi.string()).min(1).required(),
  type: Joi.string().valid('email', 'sms', 'push').required(),
  channel: Joi.string().required(),
  title: Joi.string().required(),
  content: Joi.string().required(),
  priority: Joi.string().valid('low', 'medium', 'high', 'urgent').default('medium'),
});

// Routes
router.get('/user/:userId', authMiddleware, notificationController.getUserNotifications);
router.get('/user/:userId/stats', authMiddleware, notificationController.getStats);
router.get('/:id', authMiddleware, notificationController.getNotification);
router.post('/', authMiddleware, validate(createNotificationSchema), notificationController.createNotification);
router.post('/bulk', authMiddleware, validate(bulkNotificationSchema), notificationController.sendBulkNotification);
router.patch('/:id/read', authMiddleware, notificationController.markAsRead);
router.patch('/user/:userId/read-all', authMiddleware, notificationController.markAllAsRead);
router.delete('/:id', authMiddleware, notificationController.deleteNotification);

module.exports = router;