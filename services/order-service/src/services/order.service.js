const Order = require('../models/Order.model');
const OrderItem = require('../models/OrderItem.model');
const OrderStatus = require('../models/OrderStatus.model');
const { getCache, setCache, deleteCache } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const { SagaOrchestrator } = require('./saga-orchestrator.service');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

class OrderService {
  async createOrder(orderData, userId, ipAddress, userAgent) {
    // Validate order items
    if (!orderData.items || orderData.items.length === 0) {
      throw new ApiError(400, 'Order must contain at least one item');
    }
    
    if (orderData.items.length > parseInt(process.env.MAX_ORDER_ITEMS || 50)) {
      throw new ApiError(400, `Maximum ${process.env.MAX_ORDER_ITEMS} items per order`);
    }
    
    // Calculate totals
    let subtotal = 0;
    const items = orderData.items.map(item => {
      const total = item.price * item.quantity;
      subtotal += total;
      return {
        ...item,
        total
      };
    });
    
    const tax = subtotal * (orderData.taxRate || 0.1);
    const shipping = orderData.shippingCost || 0;
    const total = subtotal + tax + shipping - (orderData.discount || 0);
    
    if (total < parseFloat(process.env.MIN_ORDER_AMOUNT || 0.01)) {
      throw new ApiError(400, `Minimum order amount is ${process.env.MIN_ORDER_AMOUNT}`);
    }
    
    if (total > parseFloat(process.env.MAX_ORDER_AMOUNT || 100000)) {
      throw new ApiError(400, `Maximum order amount is ${process.env.MAX_ORDER_AMOUNT}`);
    }
    
    // Create order
    const order = new Order({
      userId,
      customer: {
        email: orderData.customer.email,
        name: orderData.customer.name,
        phone: orderData.customer.phone
      },
      items,
      summary: {
        subtotal,
        discount: orderData.discount || 0,
        tax,
        shipping,
        total
      },
      shipping: {
        address: orderData.shipping.address,
        method: orderData.shipping.method
      },
      metadata: {
        ipAddress,
        userAgent,
        couponCode: orderData.couponCode,
        notes: orderData.notes
      },
      expiresAt: new Date(Date.now() + (parseInt(process.env.ORDER_TIMEOUT_MINUTES) || 30) * 60 * 1000)
    });
    
    await order.save();
    
    // Create order items
    for (const item of items) {
      const orderItem = new OrderItem({
        orderId: order._id,
        ...item
      });
      await orderItem.save();
    }
    
    // Create status tracker
    const statusTracker = new OrderStatus({
      orderId: order._id
    });
    await statusTracker.addStatus('pending', 'Order created', 'system');
    await statusTracker.save();
    
    // Add timeline entry
    await order.addTimelineEntry('pending', 'Order created');
    
    // Start Saga orchestration
    const sagaOrchestrator = new SagaOrchestrator();
    await sagaOrchestrator.executeOrderSaga(order);
    
    // Clear cache
    await deleteCache(`user:${userId}:orders:*`);
    
    // Publish event
    await publishEvent('order.events', 'order.created', {
      eventId: crypto.randomUUID(),
      eventType: 'order.created',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        total: order.summary.total,
        items: order.items.map(i => ({ productId: i.productId, quantity: i.quantity }))
      }
    });
    
    return order;
  }
  
  async getOrderById(orderId, userId, isAdmin = false) {
    const cached = await getCache(`order:${orderId}`);
    if (cached && (isAdmin || cached.userId === userId)) {
      return cached;
    }
    
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    if (!isAdmin && order.userId !== userId) {
      throw new ApiError(403, 'Access denied');
    }
    
    const orderItems = await OrderItem.find({ orderId: order._id });
    const statusTracker = await OrderStatus.findOne({ orderId: order._id });
    
    const result = {
      ...order.toJSON(),
      items: orderItems,
      statusHistory: statusTracker?.history || []
    };
    
    await setCache(`order:${orderId}`, result, 300);
    
    return result;
  }
  
  async getUserOrders(userId, query = {}) {
    const cacheKey = `user:${userId}:orders:${JSON.stringify(query)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    
    const { page = 1, limit = 20, status, startDate, endDate } = query;
    
    const filter = { userId };
    if (status) filter.status = status;
    if (startDate || endDate) {
      filter.createdAt = {};
      if (startDate) filter.createdAt.$gte = new Date(startDate);
      if (endDate) filter.createdAt.$lte = new Date(endDate);
    }
    
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Order.countDocuments(filter);
    
    const result = {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
    
    await setCache(cacheKey, result, 300);
    
    return result;
  }
  
  async cancelOrder(orderId, userId, reason, isAdmin = false) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    if (!isAdmin && order.userId !== userId) {
      throw new ApiError(403, 'Access denied');
    }
    
    if (!order.canCancel) {
      throw new ApiError(400, `Cannot cancel order in ${order.status} status`);
    }
    
    await order.cancel(reason);
    
    // Publish cancellation event
    await publishEvent('order.events', 'order.cancelled', {
      eventId: crypto.randomUUID(),
      eventType: 'order.cancelled',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        reason
      }
    });
    
    // Clear cache
    await deleteCache(`order:${orderId}`);
    await deleteCache(`user:${userId}:orders:*`);
    
    return order;
  }
  
  async updateOrderStatus(orderId, status, note, operator) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    const oldStatus = order.status;
    order.status = status;
    await order.addTimelineEntry(status, note || `Status changed to ${status}`);
    
    // Update status tracker
    const statusTracker = await OrderStatus.findOne({ orderId: order._id });
    if (statusTracker) {
      await statusTracker.addStatus(status, note, operator);
    }
    
    // Handle specific status transitions
    if (status === 'shipped' && order.shipping.trackingNumber) {
      await publishEvent('order.events', 'order.shipped', {
        eventId: crypto.randomUUID(),
        eventType: 'order.shipped',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'order-service',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          trackingNumber: order.shipping.trackingNumber,
          carrier: order.shipping.carrier,
          estimatedDelivery: order.shipping.estimatedDelivery
        }
      });
    }
    
    if (status === 'delivered') {
      await publishEvent('order.events', 'order.delivered', {
        eventId: crypto.randomUUID(),
        eventType: 'order.delivered',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'order-service',
        data: {
          orderId: order._id,
          orderNumber: order.orderNumber,
          userId: order.userId,
          deliveredAt: new Date()
        }
      });
    }
    
    // Clear cache
    await deleteCache(`order:${orderId}`);
    await deleteCache(`user:${order.userId}:orders:*`);
    
    return order;
  }
  
  async updateShipping(orderId, trackingNumber, carrier, estimatedDelivery) {
    const order = await Order.findById(orderId);
    if (!order) {
      throw new ApiError(404, 'Order not found');
    }
    
    await order.updateShipping(trackingNumber, carrier, new Date(estimatedDelivery));
    await order.addTimelineEntry('shipped', `Order shipped via ${carrier}, Tracking: ${trackingNumber}`);
    
    await publishEvent('order.events', 'order.shipped', {
      eventId: crypto.randomUUID(),
      eventType: 'order.shipped',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        orderId: order._id,
        orderNumber: order.orderNumber,
        userId: order.userId,
        trackingNumber,
        carrier,
        estimatedDelivery
      }
    });
    
    await deleteCache(`order:${orderId}`);
    
    return order;
  }
  
  async getOrderStats() {
    const stats = await Order.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$summary.total' }
        }
      }
    ]);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayOrders = await Order.countDocuments({
      createdAt: { $gte: today }
    });
    
    const todayRevenue = await Order.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          status: { $in: ['delivered', 'shipped', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: null,
          total: { $sum: '$summary.total' }
        }
      }
    ]);
    
    const averageOrderValue = await Order.aggregate([
      {
        $match: {
          status: { $in: ['delivered', 'shipped', 'confirmed'] }
        }
      },
      {
        $group: {
          _id: null,
          avg: { $avg: '$summary.total' }
        }
      }
    ]);
    
    return {
      byStatus: stats,
      today: {
        orders: todayOrders,
        revenue: todayRevenue[0]?.total || 0
      },
      averageOrderValue: averageOrderValue[0]?.avg || 0,
      totalOrders: await Order.countDocuments()
    };
  }
  
  async searchOrders(searchTerm, status, page = 1, limit = 20) {
    const filter = {};
    
    if (searchTerm) {
      filter.$or = [
        { orderNumber: { $regex: searchTerm, $options: 'i' } },
        { 'customer.email': { $regex: searchTerm, $options: 'i' } },
        { 'customer.name': { $regex: searchTerm, $options: 'i' } }
      ];
    }
    
    if (status) filter.status = status;
    
    const orders = await Order.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Order.countDocuments(filter);
    
    return {
      orders,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new OrderService();