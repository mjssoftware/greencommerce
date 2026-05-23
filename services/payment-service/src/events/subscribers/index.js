const { getChannel } = require('../../config/rabbitmq');
const { handleOrderCreated, handlePaymentRequest } = require('./order-payment.subscriber');
const logger = require('../../utils/logger');

const initializeSubscribers = async (channel) => {
  const queue = 'payment.service.queue';
  
  await channel.assertQueue(queue, { durable: true });
  
  channel.consume(queue, async (msg) => {
    if (!msg) return;
    
    try {
      const event = JSON.parse(msg.content.toString());
      const { routingKey } = msg.fields;
      
      logger.info(`Received event: ${routingKey}`);
      
      switch (routingKey) {
        case 'order.created':
          await handleOrderCreated(event);
          break;
        case 'payment.request':
          await handlePaymentRequest(event);
          break;
        default:
          logger.warn(`Unhandled event: ${routingKey}`);
      }
      
      channel.ack(msg);
    } catch (error) {
      logger.error('Error processing event:', error);
      channel.nack(msg, false, false);
    }
  });
  
  logger.info('Event subscribers initialized');
};

module.exports = { initializeSubscribers };