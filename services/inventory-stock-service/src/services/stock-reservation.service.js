const Inventory = require('../models/Inventory.model');
const StockMovement = require('../models/StockMovement.model');
const { setReservation, getReservation, deleteReservation } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');

class StockReservationService {
  constructor() {
    this.reservationTimeout = parseInt(process.env.RESERVATION_TIMEOUT_MINUTES) || 30;
    this.maxAttempts = parseInt(process.env.MAX_RESERVATION_ATTEMPTS) || 3;
  }
  
  async reserveStock(orderId, items, performedBy = 'system') {
    const reservationId = `res_${orderId}_${Date.now()}`;
    const reservations = [];
    const failedItems = [];
    
    try {
      logger.info(`Starting stock reservation for order ${orderId}`);
      
      for (const item of items) {
        const inventory = await Inventory.findOne({ productId: item.productId });
        
        if (!inventory) {
          failedItems.push({
            productId: item.productId,
            sku: item.sku,
            reason: 'Product not found in inventory'
          });
          continue;
        }
        
        if (!inventory.hasStock(item.quantity)) {
          failedItems.push({
            productId: item.productId,
            sku: inventory.sku,
            name: inventory.name,
            requested: item.quantity,
            available: inventory.availableQuantity,
            reason: 'Insufficient stock'
          });
          continue;
        }
        
        // Reserve the stock
        await inventory.reserve(item.quantity, reservationId);
        
        // Create stock movement record
        await this.createReservationMovement(inventory, item.quantity, 'reserve', orderId, performedBy);
        
        reservations.push({
          productId: item.productId,
          sku: inventory.sku,
          quantity: item.quantity,
          inventoryId: inventory._id
        });
        
        logger.info(`Reserved ${item.quantity} units of ${inventory.sku} for order ${orderId}`);
      }
      
      if (failedItems.length > 0) {
        // Rollback all successful reservations
        for (const reservation of reservations) {
          await this.releaseStock(orderId, [{ productId: reservation.productId, quantity: reservation.quantity }], performedBy);
        }
        
        throw new ApiError(400, 'Stock reservation failed', false, { failedItems });
      }
      
      // Store reservation in Redis with timeout
      const reservationData = {
        reservationId,
        orderId,
        items: reservations,
        createdAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + this.reservationTimeout * 60 * 1000).toISOString()
      };
      
      await setReservation(reservationId, reservationData, this.reservationTimeout * 60);
      
      // Publish reservation success event
      await publishEvent('inventory.events', 'inventory.reserved', {
        eventId: crypto.randomUUID(),
        eventType: 'inventory.reserved',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'inventory-service',
        data: {
          orderId,
          reservationId,
          items: reservations.map(r => ({
            productId: r.productId,
            sku: r.sku,
            quantity: r.quantity
          }))
        }
      });
      
      return {
        success: true,
        reservationId,
        items: reservations,
        expiresAt: reservationData.expiresAt
      };
      
    } catch (error) {
      logger.error(`Stock reservation failed for order ${orderId}:`, error);
      throw error;
    }
  }
  
  async releaseStock(orderId, items, performedBy = 'system') {
    const releases = [];
    const failedItems = [];
    
    logger.info(`Releasing stock for order ${orderId}`);
    
    for (const item of items) {
      try {
        const inventory = await Inventory.findOne({ productId: item.productId });
        
        if (!inventory) {
          failedItems.push({
            productId: item.productId,
            reason: 'Product not found in inventory'
          });
          continue;
        }
        
        await inventory.release(item.quantity);
        
        // Create stock movement record
        await this.createReservationMovement(inventory, item.quantity, 'release', orderId, performedBy);
        
        releases.push({
          productId: item.productId,
          sku: inventory.sku,
          quantity: item.quantity
        });
        
        logger.info(`Released ${item.quantity} units of ${inventory.sku} for order ${orderId}`);
        
      } catch (error) {
        logger.error(`Failed to release stock for product ${item.productId}:`, error);
        failedItems.push({
          productId: item.productId,
          error: error.message
        });
      }
    }
    
    // Delete reservation from Redis
    const reservationId = `res_${orderId}`;
    await deleteReservation(reservationId);
    
    // Publish release event
    await publishEvent('inventory.events', 'inventory.released', {
      eventId: crypto.randomUUID(),
      eventType: 'inventory.released',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'inventory-service',
      data: {
        orderId,
        items: releases,
        failedItems: failedItems.length > 0 ? failedItems : undefined
      }
    });
    
    return {
      success: true,
      releases,
      failedItems
    };
  }
  
  async confirmReservation(orderId, items, performedBy = 'system') {
    const confirmations = [];
    const failedItems = [];
    
    logger.info(`Confirming stock reservation for order ${orderId}`);
    
    for (const item of items) {
      try {
        const inventory = await Inventory.findOne({ productId: item.productId });
        
        if (!inventory) {
          failedItems.push({
            productId: item.productId,
            reason: 'Product not found in inventory'
          });
          continue;
        }
        
        await inventory.confirmDeduction(item.quantity);
        
        // Create stock movement record
        await this.createReservationMovement(inventory, item.quantity, 'confirm', orderId, performedBy);
        
        confirmations.push({
          productId: item.productId,
          sku: inventory.sku,
          quantity: item.quantity,
          newQuantity: inventory.quantity
        });
        
        logger.info(`Confirmed ${item.quantity} units deduction for ${inventory.sku} (Order: ${orderId})`);
        
      } catch (error) {
        logger.error(`Failed to confirm stock deduction for product ${item.productId}:`, error);
        failedItems.push({
          productId: item.productId,
          error: error.message
        });
      }
    }
    
    // Delete reservation from Redis
    const reservationId = `res_${orderId}`;
    await deleteReservation(reservationId);
    
    // Publish confirmation event
    await publishEvent('inventory.events', 'inventory.confirmed', {
      eventId: crypto.randomUUID(),
      eventType: 'inventory.confirmed',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'inventory-service',
      data: {
        orderId,
        items: confirmations
      }
    });
    
    return {
      success: true,
      confirmations,
      failedItems
    };
  }
  
  async createReservationMovement(inventory, quantity, type, orderId, performedBy) {
    const movement = new StockMovement({
      productId: inventory.productId,
      sku: inventory.sku,
      type: type === 'reserve' ? 'reserve' : (type === 'release' ? 'release' : 'confirm'),
      quantity,
      previousQuantity: inventory.quantity,
      newQuantity: inventory.quantity,
      previousReserved: type === 'reserve' ? inventory.reserved - quantity : inventory.reserved + quantity,
      newReserved: inventory.reserved,
      reference: orderId,
      referenceType: 'order',
      performedBy,
      performedByRole: 'system',
      metadata: {
        operation: type,
        orderId
      }
    });
    
    await movement.save();
    return movement;
  }
  
  async getActiveReservations() {
    const redisClient = require('../config/redis').getRedisClient();
    const keys = await redisClient.keys('reservation:*');
    const reservations = [];
    
    for (const key of keys) {
      const data = await redisClient.get(key);
      if (data) {
        reservations.push(JSON.parse(data));
      }
    }
    
    return reservations;
  }
  
  async cleanupExpiredReservations() {
    const reservations = await this.getActiveReservations();
    const now = new Date();
    const cleaned = [];
    
    for (const reservation of reservations) {
      const expiresAt = new Date(reservation.expiresAt);
      if (expiresAt < now) {
        // Release expired reservation
        await this.releaseStock(reservation.orderId, reservation.items, 'system');
        cleaned.push(reservation.orderId);
        logger.info(`Cleaned up expired reservation for order ${reservation.orderId}`);
      }
    }
    
    return cleaned;
  }
  
  async getReservationStatus(orderId) {
    const reservationId = `res_${orderId}`;
    const reservation = await getReservation(reservationId);
    
    if (!reservation) {
      return {
        hasReservation: false,
        message: 'No active reservation found for this order'
      };
    }
    
    const itemsStatus = [];
    for (const item of reservation.items) {
      const inventory = await Inventory.findOne({ productId: item.productId });
      itemsStatus.push({
        productId: item.productId,
        sku: item.sku,
        reservedQuantity: item.quantity,
        currentReserved: inventory?.reserved || 0,
        status: 'active'
      });
    }
    
    return {
      hasReservation: true,
      reservationId: reservation.reservationId,
      orderId: reservation.orderId,
      expiresAt: reservation.expiresAt,
      items: itemsStatus
    };
  }
}

module.exports = new StockReservationService();