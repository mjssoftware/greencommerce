const { publishEvent } = require('../../config/rabbitmq');
const crypto = require('crypto');

let channel = null;

const initializeEventPublishers = (ch) => {
  channel = ch;
};

const publishProductEvent = async (eventType, data) => {
  if (!channel) {
    console.error('RabbitMQ channel not initialized');
    return;
  }
  
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    version: '1.0',
    timestamp: new Date().toISOString(),
    source: 'product-service',
    data
  };
  
  await publishEvent('product.events', eventType, event);
};

const publishProductCreated = (product) => {
  return publishProductEvent('product.created', {
    productId: product._id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    category: product.category,
    quantity: product.inventory.quantity
  });
};

const publishProductUpdated = (product, changes) => {
  return publishProductEvent('product.updated', {
    productId: product._id,
    sku: product.sku,
    name: product.name,
    price: product.price,
    changes
  });
};

const publishProductDeleted = (productId, sku) => {
  return publishProductEvent('product.deleted', {
    productId,
    sku
  });
};

const publishInventoryUpdated = (productId, sku, quantity, operation) => {
  return publishProductEvent('inventory.updated', {
    productId,
    sku,
    quantity,
    operation,
    timestamp: new Date().toISOString()
  });
};

const publishLowStock = (productId, sku, name, currentStock, threshold) => {
  return publishProductEvent('inventory.low', {
    productId,
    sku,
    name,
    currentStock,
    threshold
  });
};

module.exports = {
  initializeEventPublishers,
  publishProductCreated,
  publishProductUpdated,
  publishProductDeleted,
  publishInventoryUpdated,
  publishLowStock
};