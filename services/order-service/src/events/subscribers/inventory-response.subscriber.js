const Order = require('../../models/Order.model');
const logger = require('../../utils/logger');

const handleInventoryResponse = async (event) => {
  const { orderId, status, items, error } = event.data;
  
  logger.info(`Processing inventory response for order ${orderId}: ${status}`);
  
  const order = await Order.findById(orderId);
  if (!order) {
    logger.error(`Order not found: ${orderId}`);
    return;
  }
  
  if (status === 'reserved') {
    order.saga.step = 'inventory_reserved';
    await order.save();
    logger.info(`Inventory reserved for order ${orderId}`);
    
  } else if (status === 'confirmed') {
    order.saga.step = 'inventory_confirmed';
    await order.save();
    logger.info(`Inventory confirmed for order ${orderId}`);
    
  } else if (status === 'failed') {
    order.status = 'failed';
    order.saga.step = 'failed';
    await order.save();
    await order.addTimelineEntry('failed', `Inventory reservation failed: ${error}`);
    logger.error(`Inventory reservation failed for order ${orderId}: ${error}`);
  }
};

module.exports = { handleInventoryResponse };