const PaymentService = require('../services/payment.service');
const { ApiResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

class PaymentController {
  async initializePayment(req, res, next) {
    try {
      const userId = req.user.id;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      const result = await PaymentService.initializePayment(
        req.body,
        userId,
        ipAddress,
        userAgent
      );
      
      ApiResponse.success(res, {
        message: 'Payment initialized successfully',
        data: result
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async verifyPayment(req, res, next) {
    try {
      const { transactionId } = req.params;
      const result = await PaymentService.verifyPayment(transactionId);
      
      ApiResponse.success(res, {
        message: 'Payment verification completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getPaymentStatus(req, res, next) {
    try {
      const { transactionId } = req.params;
      const payment = await PaymentService.getPaymentByTransactionId(transactionId);
      
      ApiResponse.success(res, {
        data: {
          transactionId: payment.transactionId,
          status: payment.status,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paidAt: payment.paymentDetails.paidAt
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getUserPayments(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await PaymentService.getUserPayments(userId, req.query);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async refundPayment(req, res, next) {
    try {
      const { transactionId } = req.params;
      const { amount, reason } = req.body;
      
      const result = await PaymentService.processRefund(transactionId, amount, reason);
      
      ApiResponse.success(res, {
        message: 'Payment refunded successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getPaymentStats(req, res, next) {
    try {
      const stats = await PaymentService.getPaymentStats();
      ApiResponse.success(res, { data: stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new PaymentController();