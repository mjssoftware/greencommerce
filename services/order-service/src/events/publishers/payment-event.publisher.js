const { publishEvent } = require('../../config/rabbitmq');
const crypto = require('crypto');

const publishPaymentEvent = async (eventType, data) => {
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    version: '1.0',
    timestamp: new Date().toISOString(),
    source: 'order-service',
    data
  };
  
  await publishEvent('payment.events', eventType, event);
};

const publishPaymentRequest = (order, paymentMethod) => {
  return publishPaymentEvent('payment.request', {
    orderId: order._id,
    orderNumber: order.orderNumber,
    userId: order.userId,
    amount: order.summary.total,
    currency: 'USD',
    paymentMethod,
    customer: order.customer
  });
};

module.exports = { publishPaymentRequest };