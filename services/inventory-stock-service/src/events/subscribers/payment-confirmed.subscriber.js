const StockReservationService = require('../../services/stock-reservation.service');
const logger = require('../../utils/logger');

const handlePaymentSuccess = async (event) => {
  const { orderId, items } = event.data;
  
  logger.info(`Processing payment success event for inventory: ${orderId}`);
  
  try {
    // Confirm stock reservation (permanent deduction)
    const result = await StockReservationService.confirmReservation(orderId, items, 'payment-service');
    
    logger.info(`Stock confirmed for order ${orderId} after successful payment`);
    
  } catch (error) {
    logger.error(`Failed to confirm stock for order ${orderId}:`, error);
  }
};

const handlePaymentFailed = async (event) => {
  const { orderId, items } = event.data;
  
  logger.info(`Processing payment failed event for inventory: ${orderId}`);
  
  try {
    // Release reserved stock since payment failed
    const result = await StockReservationService.releaseStock(orderId, items, 'payment-service');
    
    logger.info(`Stock released for order ${orderId} due to payment failure`);
    
  } catch (error) {
    logger.error(`Failed to release stock for order ${orderId}:`, error);
  }
};

module.exports = { handlePaymentSuccess, handlePaymentFailed };