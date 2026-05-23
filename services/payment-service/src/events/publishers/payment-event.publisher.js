const { publishEvent } = require('../../config/rabbitmq');
const crypto = require('crypto');

let channel = null;

const initializeEventPublishers = (ch) => {
  channel = ch;
};

const publishPaymentEvent = async (eventType, data) => {
  if (!channel) {
    console.error('RabbitMQ channel not initialized');
    return;
  }
  
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    version: '1.0',
    timestamp: new Date().toISOString(),
    source: 'payment-service',
    data
  };
  
  await publishEvent('payment.events', eventType, event);
};

const publishPaymentSuccess = (payment) => {
  return publishPaymentEvent('payment.success', {
    transactionId: payment.transactionId,
    orderId: payment.orderId,
    orderNumber: payment.orderNumber,
    userId: payment.userId,
    amount: payment.amount,
    paymentMethod: payment.paymentMethod,
    paidAt: payment.paymentDetails.paidAt
  });
};

const publishPaymentFailed = (payment, error) => {
  return publishPaymentEvent('payment.failed', {
    transactionId: payment.transactionId,
    orderId: payment.orderId,
    orderNumber: payment.orderNumber,
    userId: payment.userId,
    error
  });
};

const publishPaymentRefunded = (payment, refundAmount, reason) => {
  return publishPaymentEvent('payment.refunded', {
    transactionId: payment.transactionId,
    orderId: payment.orderId,
    orderNumber: payment.orderNumber,
    userId: payment.userId,
    refundAmount,
    reason
  });
};

module.exports = {
  initializeEventPublishers,
  publishPaymentSuccess,
  publishPaymentFailed,
  publishPaymentRefunded
};