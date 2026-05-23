const { publishEvent } = require('../../config/rabbitmq');
const crypto = require('crypto');

let channel = null;

const initializeEventPublishers = (ch) => {
  channel = ch;
};

const publishOrderEvent = async (eventType, data) => {
  if (!channel) {
    console.error('RabbitMQ channel not initialized');
    return;
  }
  
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    version: '1.0',
    timestamp: new Date().toISOString(),
    source: 'order-service',
    data
  };
  
  await publishEvent('order.events', eventType, event);
};

const publishOrderCreated = (order) => {
  return publishOrderEvent('order.created', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    total: order.summary.total,
    items: order.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
  });
};

const publishOrderConfirmed = (order) => {
  return publishOrderEvent('order.confirmed', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    confirmedAt: new Date()
  });
};

const publishOrderShipped = (order, trackingInfo) => {
  return publishOrderEvent('order.shipped', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    trackingNumber: trackingInfo.trackingNumber,
    carrier: trackingInfo.carrier,
    estimatedDelivery: trackingInfo.estimatedDelivery
  });
};

const publishOrderDelivered = (order) => {
  return publishOrderEvent('order.delivered', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    deliveredAt: new Date()
  });
};

const publishOrderCancelled = (order, reason) => {
  return publishOrderEvent('order.cancelled', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    reason,
    cancelledAt: new Date()
  });
};

const publishOrderStatusUpdated = (order, oldStatus, newStatus) => {
  return publishOrderEvent('order.status.updated', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    oldStatus,
    newStatus,
    updatedAt: new Date()
  });
};

module.exports = {
  initializeEventPublishers,
  publishOrderCreated,
  publishOrderConfirmed,
  publishOrderShipped,
  publishOrderDelivered,
  publishOrderCancelled,
  publishOrderStatusUpdated
};