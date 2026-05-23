const Inventory = require('../models/Inventory.model');
const StockMovement = require('../models/StockMovement.model');
const { getCache, setCache, deleteCache } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');

class InventoryService {
  async createInventory(inventoryData, performedBy) {
    const existingInventory = await Inventory.findOne({ sku: inventoryData.sku });
    if (existingInventory) {
      throw new ApiError(409, `Inventory with SKU ${inventoryData.sku} already exists`);
    }
    
    const inventory = new Inventory(inventoryData);
    await inventory.save();
    
    // Create stock movement record
    await this.createStockMovement({
      productId: inventory.productId,
      sku: inventory.sku,
      type: 'add',
      quantity: inventory.quantity,
      previousQuantity: 0,
      newQuantity: inventory.quantity,
      reference: inventory.productId,
      referenceType: 'adjustment',
      performedBy,
      performedByRole: 'admin',
      metadata: { notes: 'Initial inventory creation' }
    });
    
    await deleteCache(`inventory:${inventory.productId}`);
    await deleteCache(`inventory:sku:${inventory.sku}`);
    
    return inventory;
  }
  
  async getInventoryByProductId(productId, cached = true) {
    if (cached) {
      const cachedInventory = await getCache(`inventory:${productId}`);
      if (cachedInventory) return cachedInventory;
    }
    
    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      throw new ApiError(404, `Inventory not found for product ${productId}`);
    }
    
    await setCache(`inventory:${productId}`, inventory, 300);
    
    return inventory;
  }
  
  async getInventoryBySku(sku, cached = true) {
    if (cached) {
      const cachedInventory = await getCache(`inventory:sku:${sku}`);
      if (cachedInventory) return cachedInventory;
    }
    
    const inventory = await Inventory.findOne({ sku });
    if (!inventory) {
      throw new ApiError(404, `Inventory not found for SKU ${sku}`);
    }
    
    await setCache(`inventory:sku:${sku}`, inventory, 300);
    
    return inventory;
  }
  
  async updateInventory(productId, updateData, performedBy) {
    const inventory = await Inventory.findOne({ productId });
    if (!inventory) {
      throw new ApiError(404, `Inventory not found for product ${productId}`);
    }
    
    const previousQuantity = inventory.quantity;
    const previousReserved = inventory.reserved;
    
    Object.assign(inventory, updateData);
    await inventory.save();
    
    // Create stock movement record if quantity changed
    if (updateData.quantity !== undefined && updateData.quantity !== previousQuantity) {
      const quantityChange = updateData.quantity - previousQuantity;
      await this.createStockMovement({
        productId: inventory.productId,
        sku: inventory.sku,
        type: quantityChange > 0 ? 'add' : 'deduct',
        quantity: Math.abs(quantityChange),
        previousQuantity,
        newQuantity: inventory.quantity,
        reference: inventory.productId,
        referenceType: 'adjustment',
        performedBy,
        performedByRole: 'admin',
        metadata: { notes: updateData.notes || 'Inventory adjustment' }
      });
    }
    
    await deleteCache(`inventory:${productId}`);
    await deleteCache(`inventory:sku:${inventory.sku}`);
    
    // Check stock status and publish events
    await this.checkAndPublishStockStatus(inventory);
    
    return inventory;
  }
  
  async addStock(productId, quantity, notes, performedBy) {
    const inventory = await this.getInventoryByProductId(productId, false);
    const previousQuantity = inventory.quantity;
    
    await inventory.addStock(quantity, notes);
    
    await this.createStockMovement({
      productId: inventory.productId,
      sku: inventory.sku,
      type: 'add',
      quantity,
      previousQuantity,
      newQuantity: inventory.quantity,
      reference: inventory.productId,
      referenceType: 'adjustment',
      performedBy,
      performedByRole: 'admin',
      metadata: { notes }
    });
    
    await deleteCache(`inventory:${productId}`);
    await deleteCache(`inventory:sku:${inventory.sku}`);
    
    // Publish inventory updated event
    await publishEvent('inventory.events', 'inventory.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'inventory.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'inventory-service',
      data: {
        productId: inventory.productId,
        sku: inventory.sku,
        quantity: inventory.quantity,
        operation: 'add',
        change: quantity
      }
    });
    
    // Check and publish stock status
    await this.checkAndPublishStockStatus(inventory);
    
    return inventory;
  }
  
  async deductStock(productId, quantity, reason, performedBy) {
    const inventory = await this.getInventoryByProductId(productId, false);
    const previousQuantity = inventory.quantity;
    
    await inventory.deductStock(quantity, reason);
    
    await this.createStockMovement({
      productId: inventory.productId,
      sku: inventory.sku,
      type: 'deduct',
      quantity,
      previousQuantity,
      newQuantity: inventory.quantity,
      reference: inventory.productId,
      referenceType: 'adjustment',
      performedBy,
      performedByRole: 'admin',
      metadata: { reason }
    });
    
    await deleteCache(`inventory:${productId}`);
    await deleteCache(`inventory:sku:${inventory.sku}`);
    
    // Publish inventory updated event
    await publishEvent('inventory.events', 'inventory.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'inventory.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'inventory-service',
      data: {
        productId: inventory.productId,
        sku: inventory.sku,
        quantity: inventory.quantity,
        operation: 'deduct',
        change: -quantity
      }
    });
    
    await this.checkAndPublishStockStatus(inventory);
    
    return inventory;
  }
  
  async checkStockAvailability(items) {
    const results = [];
    
    for (const item of items) {
      try {
        const inventory = await this.getInventoryByProductId(item.productId);
        const available = inventory.availableQuantity;
        const hasStock = inventory.hasStock(item.quantity);
        
        results.push({
          productId: item.productId,
          sku: inventory.sku,
          name: inventory.name,
          requested: item.quantity,
          available,
          hasStock,
          allowBackorders: inventory.allowBackorders,
          message: hasStock ? 'In stock' : `Only ${available} available`
        });
      } catch (error) {
        results.push({
          productId: item.productId,
          requested: item.quantity,
          hasStock: false,
          message: 'Product not found in inventory'
        });
      }
    }
    
    return results;
  }
  
  async getAllInventory(query = {}) {
    const { page = 1, limit = 20, search, status, lowStock, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    
    const filter = {};
    if (search) {
      filter.$or = [
        { name: { $regex: search, $options: 'i' } },
        { sku: { $regex: search, $options: 'i' } }
      ];
    }
    if (status) filter.status = status;
    if (lowStock === 'true') {
      filter.$expr = { $lte: ['$available', '$lowStockThreshold'] };
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const inventory = await Inventory.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Inventory.countDocuments(filter);
    
    return {
      inventory,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  async getLowStockProducts() {
    const inventory = await Inventory.find({
      trackInventory: true,
      $expr: { $lte: ['$available', '$lowStockThreshold'] }
    }).sort({ available: 1 });
    
    return inventory;
  }
  
  async getOutOfStockProducts() {
    const inventory = await Inventory.find({
      trackInventory: true,
      available: { $lte: 0 },
      allowBackorders: false
    }).sort({ name: 1 });
    
    return inventory;
  }
  
  async getInventoryStats() {
    const totalProducts = await Inventory.countDocuments();
    const totalValue = await Inventory.aggregate([
      { $match: { 'metadata.costPrice': { $exists: true } } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$metadata.costPrice'] } } } }
    ]);
    
    const lowStock = await Inventory.countDocuments({
      trackInventory: true,
      $expr: { $lte: ['$available', '$lowStockThreshold'] }
    });
    
    const outOfStock = await Inventory.countDocuments({
      trackInventory: true,
      available: { $lte: 0 },
      allowBackorders: false
    });
    
    const reservedCount = await Inventory.aggregate([
      { $group: { _id: null, total: { $sum: '$reserved' } } }
    ]);
    
    return {
      totalProducts,
      totalValue: totalValue[0]?.total || 0,
      lowStock,
      outOfStock,
      totalReserved: reservedCount[0]?.total || 0,
      healthyStock: totalProducts - lowStock - outOfStock
    };
  }
  
  async createStockMovement(movementData) {
    const movement = new StockMovement(movementData);
    await movement.save();
    return movement;
  }
  
  async getProductMovements(productId, query = {}) {
    const { page = 1, limit = 50, type, startDate, endDate } = query;
    
    const filter = { productId };
    if (type) filter.type = type;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const movements = await StockMovement.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await StockMovement.countDocuments(filter);
    
    return {
      movements,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  async checkAndPublishStockStatus(inventory) {
    // Publish low stock alert
    if (inventory.isLowStock && !inventory._lowStockAlertSent) {
      await publishEvent('inventory.events', 'inventory.low', {
        eventId: crypto.randomUUID(),
        eventType: 'inventory.low',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'inventory-service',
        data: {
          productId: inventory.productId,
          sku: inventory.sku,
          name: inventory.name,
          currentStock: inventory.availableQuantity,
          threshold: inventory.lowStockThreshold,
          isCritical: inventory.isCriticalStock
        }
      });
      
      inventory._lowStockAlertSent = true;
      await inventory.save();
    }
    
    // Publish out of stock alert
    if (inventory.isOutOfStock) {
      await publishEvent('inventory.events', 'inventory.out.of.stock', {
        eventId: crypto.randomUUID(),
        eventType: 'inventory.out.of.stock',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'inventory-service',
        data: {
          productId: inventory.productId,
          sku: inventory.sku,
          name: inventory.name
        }
      });
    }
    
    // If stock recovered from low, reset alert flag
    if (!inventory.isLowStock && inventory._lowStockAlertSent) {
      inventory._lowStockAlertSent = false;
      await inventory.save();
    }
  }
  
  async bulkUpdateInventory(updates, performedBy) {
    const results = {
      success: [],
      failed: []
    };
    
    for (const update of updates) {
      try {
        const inventory = await this.getInventoryByProductId(update.productId, false);
        const previousQuantity = inventory.quantity;
        
        if (update.operation === 'add') {
          await inventory.addStock(update.quantity, update.notes);
        } else if (update.operation === 'deduct') {
          await inventory.deductStock(update.quantity, update.reason);
        } else if (update.operation === 'set') {
          inventory.quantity = update.quantity;
          await inventory.save();
        }
        
        await this.createStockMovement({
          productId: inventory.productId,
          sku: inventory.sku,
          type: update.operation === 'add' ? 'add' : 'deduct',
          quantity: update.quantity,
          previousQuantity,
          newQuantity: inventory.quantity,
          reference: inventory.productId,
          referenceType: 'adjustment',
          performedBy,
          performedByRole: 'admin',
          metadata: { notes: update.notes || update.reason }
        });
        
        await deleteCache(`inventory:${inventory.productId}`);
        await deleteCache(`inventory:sku:${inventory.sku}`);
        
        results.success.push({
          productId: update.productId,
          sku: inventory.sku,
          newQuantity: inventory.quantity
        });
      } catch (error) {
        results.failed.push({
          productId: update.productId,
          error: error.message
        });
      }
    }
    
    return results;
  }
}

module.exports = new InventoryService();