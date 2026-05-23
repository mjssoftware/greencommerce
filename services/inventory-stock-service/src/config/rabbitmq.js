const amqp = require('amqplib');
const logger = require('../utils/logger');

let connection = null;
let channel = null;

const connectRabbitMQ = async () => {
  try {
    const rabbitmqUrl = process.env.RABBITMQ_URL;
    connection = await amqp.connect(rabbitmqUrl);
    channel = await connection.createChannel();
    
    logger.info('RabbitMQ Connected');
    
    // Declare exchanges
    const exchanges = ['inventory.events', 'order.events', 'payment.events', 'notification.events'];
    
    for (const exchange of exchanges) {
      await channel.assertExchange(exchange, 'topic', { durable: true });
    }
    
    // Declare queues
    const queue = await channel.assertQueue('inventory.service.queue', { durable: true });
    
    // Bind to order and payment events
    await channel.bindQueue(queue.queue, 'order.events', 'order.created');
    await channel.bindQueue(queue.queue, 'order.events', 'order.cancelled');
    await channel.bindQueue(queue.queue, 'payment.events', 'payment.success');
    await channel.bindQueue(queue.queue, 'payment.events', 'payment.failed');
    
    return channel;
  } catch (error) {
    logger.error('RabbitMQ connection failed:', error);
    throw error;
  }
};

const getChannel = () => {
  if (!channel) {
    throw new Error('RabbitMQ channel not initialized');
  }
  return channel;
};

const publishEvent = async (exchange, routingKey, event) => {
  try {
    const ch = getChannel();
    const message = Buffer.from(JSON.stringify(event));
    
    ch.publish(exchange, routingKey, message, {
      persistent: true,
      timestamp: Date.now(),
      messageId: event.eventId
    });
    
    logger.info(`Event published: ${routingKey}`);
    return true;
  } catch (error) {
    logger.error('Failed to publish event:', error);
    return false;
  }
};

module.exports = { connectRabbitMQ, getChannel, publishEvent };