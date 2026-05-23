const OrderService = require('../services/order.service');
const OrderStateService = require('../services/order-state.service');
const { ApiResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

class OrderController {
  async createOrder(req, res, next) {
    try {
      const userId = req.user.id;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      const order = await OrderService.createOrder(req.body, userId, ipAddress, userAgent);
      
      ApiResponse.success(res, {
        message: 'Order created successfully',
        data: order
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async getOrderById(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.roles?.includes('admin');
      
      const order = await OrderService.getOrderById(req.params.id, userId, isAdmin);
      ApiResponse.success(res, { data: order });
    } catch (error) {
      next(error);
    }
  }
  
  async getUserOrders(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await OrderService.getUserOrders(userId, req.query);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async cancelOrder(req, res, next) {
    try {
      const userId = req.user.id;
      const isAdmin = req.user.roles?.includes('admin');
      const { reason } = req.body;
      
      const order = await OrderService.cancelOrder(req.params.id, userId, reason, isAdmin);
      ApiResponse.success(res, {
        message: 'Order cancelled successfully',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }
  
  async updateOrderStatus(req, res, next) {
    try {
      const { status, note } = req.body;
      const operator = `${req.user.email} (${req.user.id})`;
      
      const order = await OrderService.updateOrderStatus(req.params.id, status, note, operator);
      ApiResponse.success(res, {
        message: 'Order status updated successfully',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }
  
  async updateShipping(req, res, next) {
    try {
      const { trackingNumber, carrier, estimatedDelivery } = req.body;
      
      const order = await OrderService.updateShipping(
        req.params.id,
        trackingNumber,
        carrier,
        estimatedDelivery
      );
      
      ApiResponse.success(res, {
        message: 'Shipping information updated successfully',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getOrderTimeline(req, res, next) {
    try {
      const stateService = new OrderStateService();
      const timeline = await stateService.getOrderTimeline(req.params.id);
      ApiResponse.success(res, { data: timeline });
    } catch (error) {
      next(error);
    }
  }
  
  async getOrderStats(req, res, next) {
    try {
      const stats = await OrderService.getOrderStats();
      ApiResponse.success(res, { data: stats });
    } catch (error) {
      next(error);
    }
  }
  
  async searchOrders(req, res, next) {
    try {
      const { q, status, page, limit } = req.query;
      const result = await OrderService.searchOrders(q, status, page, limit);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async transitionOrderState(req, res, next) {
    try {
      const { newStatus, metadata } = req.body;
      const stateService = new OrderStateService();
      
      const order = await stateService.transitionOrder(req.params.id, newStatus, metadata);
      ApiResponse.success(res, {
        message: 'Order state transitioned successfully',
        data: order
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderController();