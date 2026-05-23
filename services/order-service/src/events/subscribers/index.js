const { getChannel } = require('../../config/rabbitmq');
const { handlePaymentResponse } = require('./payment-response.subscriber');
const { handleInventoryResponse } = require('./inventory-response.subscriber');
const logger = require('../../utils/logger');

const initializeSubscribers = async (channel) => {
  // Payment response queue
  const paymentQueue = 'payment.response.queue';
  await channel.assertQueue(paymentQueue, { durable: true });
  await channel.bindQueue(paymentQueue, 'payment.events', 'payment.response');
  
  channel.consume(paymentQueue, async (msg) => {
    if (!msg) return;
    
    try {
      const event = JSON.parse(msg.content.toString());
      await handlePaymentResponse(event);
      channel.ack(msg);
    } catch (error) {
      logger.error('Error processing payment response:', error);
      channel.nack(msg, false, false);
    }
  });
  
  // Inventory response queue
  const inventoryQueue = 'inventory.response.queue';
  await channel.assertQueue(inventoryQueue, { durable: true });
  await channel.bindQueue(inventoryQueue, 'inventory.events', 'inventory.response');
  
  channel.consume(inventoryQueue, async (msg) => {
    if (!msg) return;
    
    try {
      const event = JSON.parse(msg.content.toString());
      await handleInventoryResponse(event);
      channel.ack(msg);
    } catch (error) {
      logger.error('Error processing inventory response:', error);
      channel.nack(msg, false, false);
    }
  });
  
  logger.info('Event subscribers initialized');
};

module.exports = { initializeSubscribers };