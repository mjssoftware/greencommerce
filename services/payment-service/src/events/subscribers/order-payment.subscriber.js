const PaymentService = require('../../services/payment.service');
const logger = require('../../utils/logger');

const handleOrderCreated = async (event) => {
  const { orderId, orderNumber, userId, total, customer } = event.data;
  
  logger.info(`Processing order created event for payment: ${orderId}`);
  
  // Create payment record for order
  const paymentData = {
    orderId,
    orderNumber,
    amount: total,
    currency: 'ETB',
    customer: {
      email: customer?.email || event.data.customerEmail,
      name: customer?.name || event.data.customerName
    },
    paymentMethod: 'cash_on_delivery' // Default, can be changed later
  };
  
  try {
    // This would typically wait for user to select payment method
    // For now, just log
    logger.info(`Payment record would be created for order ${orderId}`, paymentData);
  } catch (error) {
    logger.error(`Failed to process order payment: ${error.message}`);
  }
};

const handlePaymentRequest = async (event) => {
  const { orderId, orderNumber, userId, amount, paymentMethod, customer } = event.data;
  
  logger.info(`Processing payment request for order: ${orderId}`);
  
  const paymentData = {
    orderId,
    orderNumber,
    amount,
    currency: 'ETB',
    paymentMethod,
    customer
  };
  
  try {
    const result = await PaymentService.initializePayment(
      paymentData,
      userId,
      'webhook',
      'payment-request'
    );
    
    logger.info(`Payment initialized for order ${orderId}: ${result.transactionId}`);
  } catch (error) {
    logger.error(`Failed to initialize payment: ${error.message}`);
  }
};

module.exports = { handleOrderCreated, handlePaymentRequest };