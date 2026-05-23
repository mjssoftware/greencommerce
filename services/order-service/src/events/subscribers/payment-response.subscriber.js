const Order = require('../../models/Order.model');
const { publishEvent } = require('../../config/rabbitmq');
const logger = require('../../utils/logger');
const crypto = require('crypto');

const handlePaymentResponse = async (event) => {
  const { orderId, transactionId, status, amount, error } = event.data;
  
  logger.info(`Processing payment response for order ${orderId}: ${status}`);
  
  const order = await Order.findById(orderId);
  if (!order) {
    logger.error(`Order not found: ${orderId}`);
    return;
  }
  
  if (status === 'success') {
    order.payment.transactionId = transactionId;
    order.payment.paymentStatus = 'completed';
    order.payment.amount = amount;
    order.payment.paidAt = new Date();
    order.status = 'confirmed';
    
    await order.save();
    await order.addTimelineEntry('confirmed', 'Payment confirmed');
    
    // Notify inventory service to confirm reservation
    await publishEvent('inventory.events', 'inventory.confirm', {
      eventId: crypto.randomUUID(),
      eventType: 'inventory.confirm',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        orderId: order._id,
        items: order.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      }
    });
    
    // Send notification
    await publishEvent('notification.events', 'notification.order.confirmed', {
      eventId: crypto.randomUUID(),
      eventType: 'order.confirmed',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        userId: order.userId,
        orderId: order._id,
        orderNumber: order.orderNumber,
        total: order.summary.total
      }
    });
    
  } else if (status === 'failed') {
    order.payment.paymentStatus = 'failed';
    order.status = 'payment_failed';
    
    await order.save();
    await order.addTimelineEntry('payment_failed', `Payment failed: ${error}`);
    
    // Release inventory reservation
    await publishEvent('inventory.events', 'inventory.release', {
      eventId: crypto.randomUUID(),
      eventType: 'inventory.release',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        orderId: order._id,
        items: order.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      }
    });
  }
  
  logger.info(`Payment response processed for order ${orderId}`);
};

module.exports = { handlePaymentResponse };