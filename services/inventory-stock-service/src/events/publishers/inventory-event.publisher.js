const { publishEvent } = require('../../config/rabbitmq');
const crypto = require('crypto');

let channel = null;

const initializeEventPublishers = (ch) => {
  channel = ch;
};

const publishInventoryEvent = async (eventType, data) => {
  if (!channel) {
    console.error('RabbitMQ channel not initialized');
    return;
  }
  
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    version: '1.0',
    timestamp: new Date().toISOString(),
    source: 'inventory-service',
    data
  };
  
  await publishEvent('inventory.events', eventType, event);
};

const publishInventoryReserved = (orderId, reservationId, items) => {
  return publishInventoryEvent('inventory.reserved', {
    orderId,
    reservationId,
    items: items.map(item => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity
    }))
  });
};

const publishInventoryReleased = (orderId, items) => {
  return publishInventoryEvent('inventory.released', {
    orderId,
    items: items.map(item => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity
    }))
  });
};

const publishInventoryConfirmed = (orderId, items) => {
  return publishInventoryEvent('inventory.confirmed', {
    orderId,
    items: items.map(item => ({
      productId: item.productId,
      sku: item.sku,
      quantity: item.quantity,
      newQuantity: item.newQuantity
    }))
  });
};

const publishLowStockAlert = (productId, sku, name, currentStock, threshold, isCritical) => {
  return publishInventoryEvent('inventory.low', {
    productId,
    sku,
    name,
    currentStock,
    threshold,
    isCritical
  });
};

const publishOutOfStockAlert = (productId, sku, name) => {
  return publishInventoryEvent('inventory.out.of.stock', {
    productId,
    sku,
    name
  });
};

module.exports = {
  initializeEventPublishers,
  publishInventoryReserved,
  publishInventoryReleased,
  publishInventoryConfirmed,
  publishLowStockAlert,
  publishOutOfStockAlert
};