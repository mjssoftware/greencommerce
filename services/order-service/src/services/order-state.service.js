const Order = require('../models/Order.model');
const { publishEvent } = require('../config/rabbitmq');
const logger = require('../utils/logger');

class OrderStateService {
  // State machine for order workflow
  static transitions = {
    pending: ['awaiting_payment', 'cancelled'],
    awaiting_payment: ['payment_processing', 'cancelled'],
    payment_processing: ['confirmed', 'payment_failed'],
    payment_failed: ['awaiting_payment', 'cancelled'],
    confirmed: ['processing', 'cancelled'],
    processing: ['shipped', 'cancelled'],
    shipped: ['delivered', 'cancelled'],
    delivered: ['refunded'],
    cancelled: [],
    refunded: []
  };
  
  static canTransition(from, to) {
    return this.transitions[from]?.includes(to) || false;
  }
  
  async transitionOrder(orderId, newStatus, metadata = {}) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    const oldStatus = order.status;
    
    if (!OrderStateService.canTransition(oldStatus, newStatus)) {
      throw new Error(`Invalid state transition: ${oldStatus} -> ${newStatus}`);
    }
    
    // Execute state-specific actions
    await this.executeStateActions(order, newStatus, metadata);
    
    // Update order status
    order.status = newStatus;
    await order.addTimelineEntry(newStatus, metadata.message || `Status changed to ${newStatus}`, metadata);
    
    // Publish state change event
    await publishEvent('order.events', 'order.status.updated', {
      eventId: require('crypto').randomUUID(),
      eventType: 'order.status.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        oldStatus,
        newStatus,
        metadata
      }
    });
    
    logger.info(`Order ${order.orderNumber} transitioned: ${oldStatus} -> ${newStatus}`);
    
    return order;
  }
  
  async executeStateActions(order, newStatus, metadata) {
    switch (newStatus) {
      case 'confirmed':
        // Confirm inventory deduction
        await this.confirmInventory(order);
        break;
        
      case 'shipped':
        // Update shipping info
        if (metadata.trackingNumber) {
          order.shipping.trackingNumber = metadata.trackingNumber;
          order.shipping.carrier = metadata.carrier;
          order.shipping.shippedAt = new Date();
        }
        break;
        
      case 'delivered':
        order.shipping.deliveredAt = new Date();
        break;
        
      case 'cancelled':
        // Release inventory and refund payment
        await this.handleCancellation(order, metadata);
        break;
    }
  }
  
  async confirmInventory(order) {
    // Call inventory service to confirm deduction
    try {
      const axios = require('axios');
      await axios.post(`${process.env.INVENTORY_SERVICE_URL}/api/v1/inventory/confirm`, {
        orderId: order._id,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });
    } catch (error) {
      logger.error('Failed to confirm inventory:', error);
      throw new Error('Inventory confirmation failed');
    }
  }
  
  async handleCancellation(order, metadata) {
    // Release reserved inventory
    try {
      const axios = require('axios');
      await axios.post(`${process.env.INVENTORY_SERVICE_URL}/api/v1/inventory/release`, {
        orderId: order._id,
        items: order.items.map(item => ({
          productId: item.productId,
          quantity: item.quantity
        }))
      });
    } catch (error) {
      logger.error('Failed to release inventory:', error);
    }
    
    // Process refund if payment was made
    if (order.payment.paymentStatus === 'completed') {
      try {
        const axios = require('axios');
        await axios.post(`${process.env.PAYMENT_SERVICE_URL}/api/v1/payments/refund`, {
          transactionId: order.payment.transactionId,
          amount: order.summary.total,
          reason: metadata.reason || 'Order cancelled'
        });
      } catch (error) {
        logger.error('Failed to process refund:', error);
      }
    }
  }
  
  async getOrderTimeline(orderId) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new Error('Order not found');
    }
    
    const timeline = order.timeline.map(entry => ({
      status: entry.status,
      message: entry.message,
      timestamp: entry.timestamp,
      metadata: entry.metadata
    }));
    
    // Calculate estimated delivery date
    const estimatedDelivery = this.calculateEstimatedDelivery(order);
    
    return {
      timeline,
      estimatedDelivery,
      currentStatus: order.status
    };
  }
  
  calculateEstimatedDelivery(order) {
    // Logic to calculate estimated delivery based on shipping method
    const createdDate = new Date(order.createdAt);
    switch (order.shipping.method) {
      case 'express':
        return new Date(createdDate.getTime() + 2 * 24 * 60 * 60 * 1000);
      case 'standard':
        return new Date(createdDate.getTime() + 5 * 24 * 60 * 60 * 1000);
      default:
        return new Date(createdDate.getTime() + 7 * 24 * 60 * 60 * 1000);
    }
  }
  
  async getOrderMetrics() {
    const metrics = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          avgProcessingTime: {
            $avg: {
              $cond: [
                { $eq: ['$status', 'delivered'] },
                { $subtract: ['$shipping.deliveredAt', '$createdAt'] },
                null
              ]
            }
          }
        }
      }
    ]);
    
    return metrics;
  }
}

module.exports = OrderStateService;