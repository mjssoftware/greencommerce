const { getChannel } = require('../../config/rabbitmq');
const { handleOrderCreated, handleOrderCancelled } = require('./order-inventory.subscriber');
const { handlePaymentSuccess, handlePaymentFailed } = require('./payment-confirmed.subscriber');
const logger = require('../../utils/logger');

const initializeSubscribers = async (channel) => {
  const queue = 'inventory.service.queue';
  
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
        case 'order.cancelled':
          await handleOrderCancelled(event);
          break;
        case 'payment.success':
          await handlePaymentSuccess(event);
          break;
        case 'payment.failed':
          await handlePaymentFailed(event);
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