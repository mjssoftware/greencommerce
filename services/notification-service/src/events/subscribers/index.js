const { handleUserCreated } = require('./user-created.subscriber');
const { handleOrderCreated } = require('./order-created.subscriber');
const { handlePaymentSuccess } = require('./payment-success.subscriber');
const { handleInventoryLow } = require('./inventory-low.subscriber');
const { getChannel } = require('../../config/rabbitmq');
const logger = require('../../utils/logger');

const initializeSubscribers = async (channel) => {
  const notificationQueue = 'notification.service.queue';
  
  // Event handlers mapping
  const eventHandlers = {
    'user.created': handleUserCreated,
    'user.password.reset': handlePasswordReset,
    'order.created': handleOrderCreated,
    'order.status.updated': handleOrderStatusUpdated,
    'payment.success': handlePaymentSuccess,
    'payment.failed': handlePaymentFailed,
    'inventory.low': handleInventoryLow,
    'inventory.out.of.stock': handleOutOfStock,
  };
  
  await channel.consume(notificationQueue, async (msg) => {
    if (!msg) return;
    
    try {
      const event = JSON.parse(msg.content.toString());
      const { routingKey } = msg.fields;
      
      logger.info(`Received event: ${routingKey}`, { eventId: event.eventId, timestamp: event.timestamp });
      
      const handler = eventHandlers[routingKey];
      if (handler) {
        await handler(event);
        channel.ack(msg);
        logger.info(`Successfully processed event: ${routingKey}`);
      } else {
        logger.warn(`No handler registered for event type: ${routingKey}`);
        channel.ack(msg); // Acknowledge to avoid queue buildup
      }
    } catch (error) {
      logger.error(`Error processing message: ${error.message}`, { error, msg: msg.content.toString() });
      
      // Check if we should retry
      const retryCount = (msg.properties.headers?.retryCount || 0) + 1;
      const maxRetries = 3;
      
      if (retryCount <= maxRetries) {
        logger.info(`Retrying message (${retryCount}/${maxRetries})`);
        channel.nack(msg, false, false); // Requeue for retry
      } else {
        logger.error(`Max retries reached for message, moving to DLQ`);
        // Send to dead letter queue
        await channel.publish('dead.letter.exchange', 'notification.failed', msg.content, {
          headers: { ...msg.properties.headers, finalFailure: true }
        });
        channel.ack(msg);
      }
    }
  });
  
  logger.info('Event subscribers initialized with handlers:', Object.keys(eventHandlers));
};

// Additional event handlers
const handlePasswordReset = async (event) => {
  const { addToEmailQueue } = require('../../services/queue.service');
  const Notification = require('../../models/Notification.model');
  
  const { userId, email, name, resetToken } = event.data;
  
  const notification = new Notification({
    userId,
    type: 'email',
    channel: 'user',
    title: 'Password Reset Request',
    content: 'Click the link to reset your password',
    data: { email, name, resetToken },
    priority: 'high',
  });
  
  await notification.save();
  
  await addToEmailQueue({
    type: 'password_reset',
    data: {
      notificationId: notification._id,
      email,
      name,
      resetToken,
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${resetToken}`,
      expiryTime: '1 hour',
      supportEmail: process.env.SUPPORT_EMAIL,
      year: new Date().getFullYear(),
    },
  });
  
  logger.info(`Password reset email queued for user: ${userId}`);
};

const handleOrderStatusUpdated = async (event) => {
  const { addToEmailQueue, addToSmsQueue } = require('../../services/queue.service');
  const Notification = require('../../models/Notification.model');
  
  const { orderId, userId, status, trackingNumber, estimatedDelivery, customerEmail, customerPhone } = event.data;
  
  if (status === 'shipped') {
    const notification = new Notification({
      userId,
      type: 'email',
      channel: 'order',
      title: `Order Shipped #${orderId}`,
      content: `Your order has been shipped! Tracking: ${trackingNumber}`,
      data: event.data,
      priority: 'high',
    });
    
    await notification.save();
    
    await addToEmailQueue({
      type: 'order_shipped',
      data: {
        notificationId: notification._id,
        email: customerEmail,
        orderId,
        trackingNumber,
        estimatedDelivery,
        trackingUrl: `${process.env.CARRIER_URL}/track/${trackingNumber}`,
      },
    });
    
    if (customerPhone) {
      await addToSmsQueue({
        type: 'order_shipped',
        data: {
          phoneNumber: customerPhone,
          orderId,
          trackingNumber,
          estimatedDelivery,
        },
      });
    }
    
    logger.info(`Order shipped notification sent for order: ${orderId}`);
  } else if (status === 'delivered') {
    const notification = new Notification({
      userId,
      type: 'email',
      channel: 'order',
      title: `Order Delivered #${orderId}`,
      content: 'Your order has been delivered!',
      data: event.data,
    });
    
    await notification.save();
    
    await addToEmailQueue({
      type: 'order_delivered',
      data: {
        notificationId: notification._id,
        email: customerEmail,
        orderId,
        ratingUrl: `${process.env.FRONTEND_URL}/orders/${orderId}/rate`,
      },
    });
  }
};

const handlePaymentFailed = async (event) => {
  const { addToEmailQueue, addToSmsQueue } = require('../../services/queue.service');
  const Notification = require('../../models/Notification.model');
  
  const { orderId, userId, amount, reason, customerEmail, customerPhone } = event.data;
  
  const notification = new Notification({
    userId,
    type: 'email',
    channel: 'payment',
    title: 'Payment Failed',
    content: `Payment of $${amount} for order #${orderId} failed. Reason: ${reason}`,
    data: event.data,
    priority: 'urgent',
  });
  
  await notification.save();
  
  await addToEmailQueue({
    type: 'payment_failed',
    data: {
      notificationId: notification._id,
      email: customerEmail,
      orderId,
      amount,
      reason,
      retryUrl: `${process.env.FRONTEND_URL}/checkout/${orderId}/payment`,
    },
  });
  
  if (customerPhone) {
    await addToSmsQueue({
      type: 'payment_failed',
      data: {
        phoneNumber: customerPhone,
        orderId,
        amount,
      },
    });
  }
  
  logger.info(`Payment failed notification sent for order: ${orderId}`);
};

const handleOutOfStock = async (event) => {
  const { addToEmailQueue } = require('../../services/queue.service');
  const Notification = require('../../models/Notification.model');
  
  const { productId, name, sku } = event.data;
  
  const notification = new Notification({
    userId: 'admin',
    type: 'email',
    channel: 'inventory',
    title: 'Out of Stock Alert',
    content: `${name} (SKU: ${sku}) is out of stock!`,
    data: event.data,
    priority: 'urgent',
  });
  
  await notification.save();
  
  await addToEmailQueue({
    type: 'out_of_stock',
    data: {
      notificationId: notification._id,
      productId,
      name,
      sku,
    },
  });
  
  logger.info(`Out of stock alert sent for product: ${productId}`);
};

module.exports = { initializeSubscribers };