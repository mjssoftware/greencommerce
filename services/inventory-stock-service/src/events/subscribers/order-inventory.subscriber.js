const StockReservationService = require('../../services/stock-reservation.service');
const InventoryService = require('../../services/inventory.service');
const logger = require('../../utils/logger');

const handleOrderCreated = async (event) => {
  const { orderId, items } = event.data;
  
  logger.info(`Processing order created event for inventory: ${orderId}`);
  
  try {
    // Reserve stock for the order
    const result = await StockReservationService.reserveStock(orderId, items, 'order-service');
    
    logger.info(`Stock reserved for order ${orderId}: ${result.reservationId}`);
    
    // Publish response back to order service
    const { publishEvent } = require('../../config/rabbitmq');
    await publishEvent('inventory.events', 'inventory.response', {
      eventId: require('crypto').randomUUID(),
      eventType: 'inventory.response',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'inventory-service',
      data: {
        orderId,
        status: 'reserved',
        reservationId: result.reservationId,
        items: result.items
      }
    });
    
  } catch (error) {
    logger.error(`Failed to reserve stock for order ${orderId}:`, error);
    
    // Publish failure response
    const { publishEvent } = require('../../config/rabbitmq');
    await publishEvent('inventory.events', 'inventory.response', {
      eventId: require('crypto').randomUUID(),
      eventType: 'inventory.response',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'inventory-service',
      data: {
        orderId,
        status: 'failed',
        error: error.message
      }
    });
  }
};

const handleOrderCancelled = async (event) => {
  const { orderId, items } = event.data;
  
  logger.info(`Processing order cancelled event for inventory: ${orderId}`);
  
  try {
    // Release reserved stock
    const result = await StockReservationService.releaseStock(orderId, items, 'order-service');
    
    logger.info(`Stock released for cancelled order ${orderId}`);
    
  } catch (error) {
    logger.error(`Failed to release stock for order ${orderId}:`, error);
  }
};

module.exports = { handleOrderCreated, handleOrderCancelled };