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
    
    // Handle connection events
    connection.on('error', (err) => {
      logger.error('RabbitMQ connection error:', err);
    });
    
    connection.on('close', () => {
      logger.warn('RabbitMQ connection closed');
      setTimeout(connectRabbitMQ, 5000);
    });
    
    // Declare exchanges
    const exchanges = [
      'user.events',
      'auth.events',
      'notification.events'
    ];
    
    for (const exchange of exchanges) {
      await channel.assertExchange(exchange, 'topic', { 
        durable: true,
        autoDelete: false
      });
    }
    
    // Declare queues
    const queues = [
      'auth.service.queue',
      'user.created.queue'
    ];
    
    for (const queue of queues) {
      await channel.assertQueue(queue, { 
        durable: true,
        maxPriority: 10
      });
    }
    
    // Bind queues
    await channel.bindQueue('auth.service.queue', 'user.events', 'user.*');
    await channel.bindQueue('user.created.queue', 'user.events', 'user.created');
    
    // Prefetch to control concurrency
    await channel.prefetch(10);
    
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
      messageId: event.eventId,
      contentType: 'application/json'
    });
    
    logger.info(`Event published: ${routingKey}`, { eventId: event.eventId });
    return true;
  } catch (error) {
    logger.error('Failed to publish event:', error);
    return false;
  }
};

const closeConnection = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  }
};

module.exports = { 
  connectRabbitMQ, 
  getChannel, 
  publishEvent, 
  closeConnection 
};