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
    });
    
    // Declare exchanges
    const exchanges = [
      'user.events',
      'order.events',
      'payment.events',
      'inventory.events',
      'notification.events'
    ];
    
    for (const exchange of exchanges) {
      await channel.assertExchange(exchange, 'topic', { durable: true });
    }
    
    // Declare queues
    const notificationQueue = await channel.assertQueue('notification.service.queue', {
      durable: true,
    });
    
    // Bind queues to exchanges
    const bindings = [
      { exchange: 'user.events', routingKey: 'user.created' },
      { exchange: 'user.events', routingKey: 'user.password.reset' },
      { exchange: 'order.events', routingKey: 'order.created' },
      { exchange: 'order.events', routingKey: 'order.status.updated' },
      { exchange: 'payment.events', routingKey: 'payment.success' },
      { exchange: 'payment.events', routingKey: 'payment.failed' },
      { exchange: 'inventory.events', routingKey: 'inventory.low' },
      { exchange: 'inventory.events', routingKey: 'inventory.out.of.stock' },
    ];
    
    for (const binding of bindings) {
      await channel.bindQueue(
        notificationQueue.queue,
        binding.exchange,
        binding.routingKey
      );
    }
    
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

const closeConnection = async () => {
  try {
    if (channel) await channel.close();
    if (connection) await connection.close();
    logger.info('RabbitMQ connection closed');
  } catch (error) {
    logger.error('Error closing RabbitMQ connection:', error);
  }
};

module.exports = { connectRabbitMQ, getChannel, closeConnection };