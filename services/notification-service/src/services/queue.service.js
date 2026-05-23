const Queue = require('bull');
const { getRedisClient } = require('../config/redis');
const emailService = require('./email.service');
const smsService = require('./sms.service');
const Notification = require('../models/Notification.model');
const logger = require('../utils/logger');

let emailQueue = null;
let smsQueue = null;
let notificationQueue = null;

const initializeQueues = async () => {
  const redisClient = getRedisClient();
  const redisConfig = {
    redis: {
      port: process.env.REDIS_PORT,
      host: process.env.REDIS_HOST,
      password: process.env.REDIS_PASSWORD,
    },
  };
  
  // Email queue
  emailQueue = new Queue('email_queue', redisConfig);
  emailQueue.process(async (job) => {
    const { type, data } = job.data;
    
    try {
      switch (type) {
        case 'welcome':
          await emailService.sendWelcomeEmail(data);
          break;
        case 'order_confirmation':
          await emailService.sendOrderConfirmation(data);
          break;
        case 'payment_receipt':
          await emailService.sendPaymentReceipt(data);
          break;
        case 'password_reset':
          await emailService.sendPasswordReset(data);
          break;
        case 'low_stock':
          await emailService.sendLowStockAlert(data);
          break;
        default:
          logger.warn(`Unknown email type: ${type}`);
      }
      
      // Update notification status
      if (data.notificationId) {
        await Notification.findByIdAndUpdate(data.notificationId, {
          status: 'sent',
          sentAt: new Date(),
        });
      }
      
      return { success: true };
    } catch (error) {
      logger.error(`Failed to process email job: ${error.message}`);
      
      if (data.notificationId) {
        await Notification.findByIdAndUpdate(data.notificationId, {
          status: 'failed',
          failedReason: error.message,
          $inc: { retryCount: 1 },
        });
      }
      
      throw error;
    }
  });
  
  // SMS queue
  smsQueue = new Queue('sms_queue', redisConfig);
  smsQueue.process(async (job) => {
    const { type, data } = job.data;
    
    try {
      switch (type) {
        case 'order_confirmation':
          await smsService.sendOrderConfirmation(data.phoneNumber, data);
          break;
        case 'order_shipped':
          await smsService.sendOrderShipped(data.phoneNumber, data);
          break;
        case 'payment_confirmation':
          await smsService.sendPaymentConfirmation(data.phoneNumber, data);
          break;
        case 'otp':
          await smsService.sendOTP(data.phoneNumber, data.otpCode);
          break;
        default:
          logger.warn(`Unknown SMS type: ${type}`);
      }
      
      return { success: true };
    } catch (error) {
      logger.error(`Failed to process SMS job: ${error.message}`);
      throw error;
    }
  });
  
  // Notification queue for retries
  notificationQueue = new Queue('notification_queue', redisConfig);
  notificationQueue.process(async (job) => {
    const { notificationId, retryCount = 0 } = job.data;
    
    const notification = await Notification.findById(notificationId);
    if (!notification) {
      logger.error(`Notification not found: ${notificationId}`);
      return;
    }
    
    // Retry logic
    if (retryCount < 3) {
      await new Promise(resolve => setTimeout(resolve, Math.pow(2, retryCount) * 1000));
      
      // Re-add to appropriate queue
      if (notification.type === 'email') {
        await emailQueue.add(notification.data, { delay: 5000 });
      } else if (notification.type === 'sms') {
        await smsQueue.add(notification.data, { delay: 5000 });
      }
    }
  });
  
  // Event handlers
  emailQueue.on('completed', (job) => {
    logger.info(`Email job ${job.id} completed`);
  });
  
  emailQueue.on('failed', (job, err) => {
    logger.error(`Email job ${job.id} failed: ${err.message}`);
  });
  
  smsQueue.on('completed', (job) => {
    logger.info(`SMS job ${job.id} completed`);
  });
  
  smsQueue.on('failed', (job, err) => {
    logger.error(`SMS job ${job.id} failed: ${err.message}`);
  });
  
  logger.info('Queues initialized successfully');
};

const addToEmailQueue = async (data) => {
  return await emailQueue.add(data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  });
};

const addToSmsQueue = async (data) => {
  return await smsQueue.add(data, {
    attempts: 3,
    backoff: {
      type: 'exponential',
      delay: 2000,
    },
    removeOnComplete: true,
  });
};

module.exports = {
  initializeQueues,
  addToEmailQueue,
  addToSmsQueue,
};