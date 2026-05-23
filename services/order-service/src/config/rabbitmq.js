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
    const exchanges = [
      'order.events',
      'payment.events',
      'inventory.events',
      'notification.events'
    ];
    
    for (const exchange of exchanges) {
      await channel.assertExchange(exchange, 'topic', { durable: true });
    }
    
    // Declare queues
    const queues = [
      'order.service.queue',
      'payment.response.queue',
      'inventory.response.queue'
    ];
    
    for (const queue of queues) {
      await channel.assertQueue(queue, { durable: true });
    }
    
    // Bind queues
    await channel.bindQueue('order.service.queue', 'payment.events', 'payment.*');
    await channel.bindQueue('order.service.queue', 'inventory.events', 'inventory.*');
    await channel.bindQueue('payment.response.queue', 'payment.events', 'payment.response');
    await channel.bindQueue('inventory.response.queue', 'inventory.events', 'inventory.response');
    
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