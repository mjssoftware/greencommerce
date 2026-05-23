const Order = require('../models/Order.model');
const OrderStatus = require('../models/OrderStatus.model');
const { ApiResponse } = require('../utils/api-response');
const { ApiError } = require('../utils/api-error');

class OrderStatusController {
  async getOrderStatus(req, res, next) {
    try {
      const { orderId } = req.params;
      
      const status = await OrderStatus.findOne({ orderId });
      if (!status) {
        throw new ApiError(404, 'Order status not found');
      }
      
      ApiResponse.success(res, { data: status });
    } catch (error) {
      next(error);
    }
  }
  
  async updateOrderStatus(req, res, next) {
    try {
      const { orderId } = req.params;
      const { status, note } = req.body;
      
      const orderStatus = await OrderStatus.findOne({ orderId });
      if (!orderStatus) {
        throw new ApiError(404, 'Order status not found');
      }
      
      await orderStatus.addStatus(status, note, req.user?.email || 'system');
      
      // Update main order status
      await Order.findByIdAndUpdate(orderId, { status });
      
      ApiResponse.success(res, {
        message: 'Order status updated successfully',
        data: orderStatus
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getStatusHistory(req, res, next) {
    try {
      const { orderId } = req.params;
      
      const orderStatus = await OrderStatus.findOne({ orderId });
      if (!orderStatus) {
        throw new ApiError(404, 'Order status not found');
      }
      
      ApiResponse.success(res, { data: orderStatus.history });
    } catch (error) {
      next(error);
    }
  }
  
  async getStatusMetrics(req, res, next) {
    try {
      const metrics = await Order.aggregate([
        {
          $group: {
            _id: '$status',
            count: { $sum: 1 },
            avgTotal: { $avg: '$summary.total' }
          }
        }
      ]);
      
      ApiResponse.success(res, { data: metrics });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new OrderStatusController();