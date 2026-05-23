const { getChannel } = require('../../config/rabbitmq');
const logger = require('../../utils/logger');

class NotificationSubscriber {
  static async initialize() {
    const channel = getChannel();
    const queue = 'auth.service.queue';
    
    await channel.assertQueue(queue, { durable: true });
    
    // Bind to notification events
    await channel.bindQueue(queue, 'notification.events', 'notification.*');
    
    channel.consume(queue, async (msg) => {
      if (!msg) return;
      
      try {
        const event = JSON.parse(msg.content.toString());
        logger.info(`Received notification event: ${event.eventType}`);
        
        switch (event.eventType) {
          case 'notification.email.sent':
            await this.handleEmailSent(event);
            break;
          case 'notification.email.failed':
            await this.handleEmailFailed(event);
            break;
          case 'notification.sms.sent':
            await this.handleSmsSent(event);
            break;
          default:
            logger.warn(`Unhandled notification event: ${event.eventType}`);
        }
        
        channel.ack(msg);
      } catch (error) {
        logger.error('Error processing notification event:', error);
        channel.nack(msg, false, false);
      }
    });
    
    logger.info('Notification subscriber initialized');
  }
  
  static async handleEmailSent(event) {
    const { userId, email, notificationType } = event.data;
    logger.info(`Email notification sent to user ${userId}`, { email, notificationType });
    // Update user's notification history if needed
  }
  
  static async handleEmailFailed(event) {
    const { userId, email, error } = event.data;
    logger.error(`Email notification failed for user ${userId}`, { email, error });
    // Handle failed email (retry queue, mark as failed, etc.)
  }
  
  static async handleSmsSent(event) {
    const { userId, phoneNumber, notificationType } = event.data;
    logger.info(`SMS notification sent to user ${userId}`, { phoneNumber, notificationType });
  }
}

module.exports = NotificationSubscriber;