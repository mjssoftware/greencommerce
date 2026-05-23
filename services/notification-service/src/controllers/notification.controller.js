const Notification = require('../models/Notification.model');
const { addToEmailQueue, addToSmsQueue } = require('../services/queue.service');
const { getChannel } = require('../config/rabbitmq');
const logger = require('../utils/logger');

const notificationController = {
  // Get user notifications
  async getUserNotifications(req, res) {
    try {
      const { userId } = req.params;
      const { page = 1, limit = 20, status, channel } = req.query;
      
      const query = { userId };
      if (status) query.status = status;
      if (channel) query.channel = channel;
      
      const notifications = await Notification.find(query)
        .sort({ createdAt: -1 })
        .limit(limit * 1)
        .skip((page - 1) * limit);
      
      const total = await Notification.countDocuments(query);
      
      res.json({
        success: true,
        data: notifications,
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          pages: Math.ceil(total / limit),
        },
      });
    } catch (error) {
      logger.error('Error fetching notifications:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  
  // Get single notification
  async getNotification(req, res) {
    try {
      const { id } = req.params;
      const notification = await Notification.findById(id);
      
      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      
      res.json({ success: true, data: notification });
    } catch (error) {
      logger.error('Error fetching notification:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  
  // Create notification
  async createNotification(req, res) {
    try {
      const { userId, type, channel, title, content, priority, scheduledFor } = req.body;
      
      const notification = new Notification({
        userId,
        type,
        channel,
        title,
        content,
        priority,
        scheduledFor,
      });
      
      await notification.save();
      
      // Send immediately if scheduled for now
      if (!scheduledFor || new Date(scheduledFor) <= new Date()) {
        if (type === 'email') {
          await addToEmailQueue({
            type: 'custom',
            data: {
              notificationId: notification._id,
              ...req.body,
            },
          });
        } else if (type === 'sms') {
          await addToSmsQueue({
            type: 'custom',
            data: {
              notificationId: notification._id,
              ...req.body,
            },
          });
        }
      }
      
      res.status(201).json({ success: true, data: notification });
    } catch (error) {
      logger.error('Error creating notification:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  
  // Mark notification as read
  async markAsRead(req, res) {
    try {
      const { id } = req.params;
      const notification = await Notification.findById(id);
      
      if (!notification) {
        return res.status(404).json({ success: false, message: 'Notification not found' });
      }
      
      await notification.markAsRead();
      
      res.json({ success: true, data: notification });
    } catch (error) {
      logger.error('Error marking notification as read:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  
  // Mark all as read
  async markAllAsRead(req, res) {
    try {
      const { userId } = req.params;
      
      await Notification.updateMany(
        { userId, status: 'delivered' },
        { status: 'read', readAt: new Date() }
      );
      
      res.json({ success: true, message: 'All notifications marked as read' });
    } catch (error) {
      logger.error('Error marking all as read:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  
  // Delete notification
  async deleteNotification(req, res) {
    try {
      const { id } = req.params;
      await Notification.findByIdAndDelete(id);
      
      res.json({ success: true, message: 'Notification deleted successfully' });
    } catch (error) {
      logger.error('Error deleting notification:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  
  // Get notification stats
  async getStats(req, res) {
    try {
      const { userId } = req.params;
      
      const stats = await Notification.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
          },
        },
      ]);
      
      const channelStats = await Notification.aggregate([
        { $match: { userId } },
        {
          $group: {
            _id: '$channel',
            count: { $sum: 1 },
          },
        },
      ]);
      
      res.json({
        success: true,
        data: {
          status: stats,
          channels: channelStats,
        },
      });
    } catch (error) {
      logger.error('Error fetching stats:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
  
  // Send bulk notification
  async sendBulkNotification(req, res) {
    try {
      const { userIds, type, channel, title, content, priority } = req.body;
      
      const notifications = userIds.map(userId => ({
        userId,
        type,
        channel,
        title,
        content,
        priority,
      }));
      
      const created = await Notification.insertMany(notifications);
      
      // Queue for sending
      for (const notification of created) {
        if (type === 'email') {
          await addToEmailQueue({
            type: 'bulk',
            data: {
              notificationId: notification._id,
              ...req.body,
            },
          });
        }
      }
      
      res.status(201).json({
        success: true,
        message: `${created.length} notifications created`,
        data: created,
      });
    } catch (error) {
      logger.error('Error sending bulk notifications:', error);
      res.status(500).json({ success: false, message: error.message });
    }
  },
};

module.exports = notificationController;