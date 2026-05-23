const { addToEmailQueue, addToSmsQueue } = require('../../services/queue.service');
const Notification = require('../../models/Notification.model');
const logger = require('../../utils/logger');

const handleUserCreated = async (event) => {
  try {
    const { userId, email, name, phoneNumber, preferredLanguage = 'en' } = event.data;
    
    logger.info(`Processing user created event for user: ${userId}`);
    
    // Create email notification
    const emailNotification = new Notification({
      userId,
      type: 'email',
      channel: 'user',
      title: 'Welcome to Our E-commerce Platform!',
      content: `Welcome ${name}! Thank you for joining us.`,
      data: {
        email,
        name,
        preferredLanguage,
        registrationDate: new Date(),
      },
      priority: 'high',
      metadata: {
        eventType: 'user.created',
        eventVersion: '1.0',
      },
    });
    
    await emailNotification.save();
    
    // Queue welcome email
    await addToEmailQueue({
      type: 'welcome',
      data: {
        notificationId: emailNotification._id,
        email,
        name,
        preferredLanguage,
        loginUrl: `${process.env.FRONTEND_URL}/login`,
        supportEmail: process.env.SUPPORT_EMAIL,
        year: new Date().getFullYear(),
      },
    });
    
    // Send SMS if phone number is provided
    if (phoneNumber) {
      const smsNotification = new Notification({
        userId,
        type: 'sms',
        channel: 'user',
        title: 'Welcome Message',
        content: `Welcome ${name}! Thank you for joining.`,
        data: {
          phoneNumber,
          name,
          preferredLanguage,
        },
        priority: 'medium',
      });
      
      await smsNotification.save();
      
      await addToSmsQueue({
        type: 'welcome',
        data: {
          notificationId: smsNotification._id,
          phoneNumber,
          name,
          preferredLanguage,
        },
      });
    }
    
    // Create in-app notification
    const inAppNotification = new Notification({
      userId,
      type: 'in_app',
      channel: 'user',
      title: 'Welcome! 🎉',
      content: `Welcome ${name}! Explore our products and get 10% off your first order.`,
      data: {
        discountCode: 'WELCOME10',
        expiresAt: new Date(Date.now() + 30 * 24 * 60 * 60 * 1000), // 30 days
      },
      priority: 'high',
    });
    
    await inAppNotification.save();
    
    logger.info(`User created notifications queued for user: ${userId}`);
    
    // Emit event for analytics
    // await publishToAnalytics('user.welcome.sent', { userId, email });
    
  } catch (error) {
    logger.error('Error handling user created event:', error);
    throw error;
  }
};

module.exports = { handleUserCreated };