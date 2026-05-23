const Payment = require('../models/Payment.model');
const ChapaConfig = require('../config/chapa');
const TelebirrConfig = require('../config/tele birr');
const { publishEvent } = require('../config/rabbitmq');
const { getCache, setCache, deleteCache } = require('../config/redis');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

class PaymentService {
  async initializePayment(paymentData, userId, ipAddress, userAgent) {
    const { orderId, orderNumber, amount, currency, paymentMethod, customer, returnUrl } = paymentData;
    
    // Validate amount
    if (amount < parseFloat(process.env.MIN_PAYMENT_AMOUNT || 1)) {
      throw new ApiError(400, `Minimum payment amount is ${process.env.MIN_PAYMENT_AMOUNT} ETB`);
    }
    
    if (amount > parseFloat(process.env.MAX_PAYMENT_AMOUNT || 1000000)) {
      throw new ApiError(400, `Maximum payment amount is ${process.env.MAX_PAYMENT_AMOUNT} ETB`);
    }
    
    // Generate transaction ID
    const transactionId = `TXN-${Date.now()}-${crypto.randomBytes(4).toString('hex').toUpperCase()}`;
    
    // Create payment record
    const payment = new Payment({
      transactionId,
      orderId,
      orderNumber,
      userId,
      customer,
      amount,
      currency: currency || 'ETB',
      paymentMethod,
      metadata: {
        ipAddress,
        userAgent,
        returnUrl
      },
      expiresAt: new Date(Date.now() + (parseInt(process.env.PAYMENT_TIMEOUT_MINUTES) || 30) * 60 * 1000)
    });
    
    await payment.save();
    
    // Initialize with selected payment provider
    let providerResult;
    
    switch (paymentMethod) {
      case 'chapa':
        providerResult = await this.initializeChapaPayment(payment, returnUrl);
        break;
      case 'tele birr':
        providerResult = await this.initializeTelebirrPayment(payment, returnUrl);
        break;
      case 'cash_on_delivery':
        providerResult = await this.initializeCashOnDelivery(payment);
        break;
      default:
        throw new ApiError(400, `Unsupported payment method: ${paymentMethod}`);
    }
    
    if (!providerResult.success) {
      payment.status = 'failed';
      payment.errorMessage = providerResult.error;
      await payment.save();
      throw new ApiError(400, providerResult.error);
    }
    
    // Update payment with provider data
    payment.providerData = {
      ...payment.providerData,
      ...providerResult.providerData
    };
    await payment.save();
    
    // Cache payment
    await setCache(`payment:${transactionId}`, payment, 300);
    
    // Publish event
    await publishEvent('payment.events', 'payment.initialized', {
      eventId: crypto.randomUUID(),
      eventType: 'payment.initialized',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'payment-service',
      data: {
        transactionId: payment.transactionId,
        orderId: payment.orderId,
        userId: payment.userId,
        amount: payment.amount,
        paymentMethod: payment.paymentMethod
      }
    });
    
    return {
      transactionId: payment.transactionId,
      paymentUrl: providerResult.paymentUrl,
      status: payment.status
    };
  }
  
  async initializeChapaPayment(payment, returnUrl) {
    const paymentData = {
      amount: payment.amount,
      currency: payment.currency,
      email: payment.customer.email,
      firstName: payment.customer.name.split(' ')[0],
      lastName: payment.customer.name.split(' ').slice(1).join(' ') || 'Customer',
      transactionId: payment.transactionId,
      orderNumber: payment.orderNumber,
      returnUrl: returnUrl || `${process.env.FRONTEND_URL}/payment/status?tx_ref=${payment.transactionId}`
    };
    
    const result = await ChapaConfig.initializePayment(paymentData);
    
    if (result.success) {
      return {
        success: true,
        paymentUrl: result.checkoutUrl,
        providerData: {
          reference: result.reference,
          checkoutUrl: result.checkoutUrl
        }
      };
    }
    
    return {
      success: false,
      error: result.error
    };
  }
  
  async initializeTelebirrPayment(payment, returnUrl) {
    const paymentData = {
      amount: payment.amount,
      transactionId: payment.transactionId,
      orderNumber: payment.orderNumber,
      returnUrl: returnUrl || `${process.env.FRONTEND_URL}/payment/status?tx_ref=${payment.transactionId}`
    };
    
    const result = await TelebirrConfig.initializePayment(paymentData);
    
    if (result.success) {
      return {
        success: true,
        paymentUrl: result.paymentUrl,
        providerData: {
          orderId: result.orderId,
          paymentUrl: result.paymentUrl
        }
      };
    }
    
    return {
      success: false,
      error: result.error
    };
  }
  
  async initializeCashOnDelivery(payment) {
    // For COD, payment is marked as pending and will be collected on delivery
    payment.status = 'pending';
    await payment.save();
    
    return {
      success: true,
      paymentUrl: null,
      providerData: {
        type: 'cash_on_delivery',
        message: 'Payment will be collected upon delivery'
      }
    };
  }
  
  async verifyPayment(transactionId) {
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    // Check cache
    const cached = await getCache(`payment:verified:${transactionId}`);
    if (cached) return cached;
    
    let verificationResult;
    
    switch (payment.paymentMethod) {
      case 'chapa':
        verificationResult = await this.verifyChapaPayment(payment);
        break;
      case 'tele birr':
        verificationResult = await this.verifyTelebirrPayment(payment);
        break;
      case 'cash_on_delivery':
        verificationResult = { success: true, status: 'pending' };
        break;
      default:
        throw new ApiError(400, `Unsupported payment method: ${payment.paymentMethod}`);
    }
    
    if (verificationResult.success && verificationResult.status === 'completed') {
      await payment.markCompleted(verificationResult.data);
      
      // Notify order service
      await publishEvent('payment.events', 'payment.success', {
        eventId: crypto.randomUUID(),
        eventType: 'payment.success',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'payment-service',
        data: {
          transactionId: payment.transactionId,
          orderId: payment.orderId,
          orderNumber: payment.orderNumber,
          userId: payment.userId,
          amount: payment.amount,
          paymentMethod: payment.paymentMethod,
          paidAt: payment.paymentDetails.paidAt
        }
      });
      
      // Notify notification service
      await publishEvent('notification.events', 'payment.success', {
        eventId: crypto.randomUUID(),
        eventType: 'payment.success',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'payment-service',
        data: {
          userId: payment.userId,
          orderId: payment.orderId,
          orderNumber: payment.orderNumber,
          amount: payment.amount,
          customerEmail: payment.customer.email
        }
      });
      
      // Clear cache
      await deleteCache(`payment:${transactionId}`);
    } else if (verificationResult.success === false) {
      await payment.markFailed(verificationResult.error);
      
      // Notify order service of failure
      await publishEvent('payment.events', 'payment.failed', {
        eventId: crypto.randomUUID(),
        eventType: 'payment.failed',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'payment-service',
        data: {
          transactionId: payment.transactionId,
          orderId: payment.orderId,
          orderNumber: payment.orderNumber,
          userId: payment.userId,
          error: verificationResult.error
        }
      });
    }
    
    const result = {
      transactionId: payment.transactionId,
      status: payment.status,
      amount: payment.amount,
      paymentMethod: payment.paymentMethod,
      paidAt: payment.paymentDetails.paidAt
    };
    
    await setCache(`payment:verified:${transactionId}`, result, 300);
    
    return result;
  }
  
  async verifyChapaPayment(payment) {
    const reference = payment.providerData.reference;
    if (!reference) {
      return { success: false, error: 'No payment reference found' };
    }
    
    return await ChapaConfig.verifyPayment(reference);
  }
  
  async verifyTelebirrPayment(payment) {
    return await TelebirrConfig.verifyPayment(payment.transactionId);
  }
  
  async processRefund(transactionId, amount, reason) {
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    if (payment.status !== 'completed') {
      throw new ApiError(400, `Cannot refund payment with status: ${payment.status}`);
    }
    
    const refundAmount = amount || payment.amount;
    
    let refundResult;
    
    switch (payment.paymentMethod) {
      case 'chapa':
        refundResult = await ChapaConfig.refundPayment(transactionId, refundAmount, reason);
        break;
      case 'tele birr':
        refundResult = await TelebirrConfig.refundPayment(transactionId, refundAmount, reason);
        break;
      default:
        throw new ApiError(400, `Refund not supported for ${payment.paymentMethod}`);
    }
    
    if (refundResult.success) {
      await payment.markRefunded(refundAmount, reason, refundResult.refundId);
      
      // Notify order service
      await publishEvent('payment.events', 'payment.refunded', {
        eventId: crypto.randomUUID(),
        eventType: 'payment.refunded',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'payment-service',
        data: {
          transactionId: payment.transactionId,
          orderId: payment.orderId,
          userId: payment.userId,
          refundAmount,
          reason
        }
      });
      
      await deleteCache(`payment:${transactionId}`);
      await deleteCache(`payment:verified:${transactionId}`);
      
      return {
        success: true,
        refundId: refundResult.refundId,
        refundAmount
      };
    }
    
    throw new ApiError(400, refundResult.error);
  }
  
  async getPaymentByTransactionId(transactionId) {
    const cached = await getCache(`payment:${transactionId}`);
    if (cached) return cached;
    
    const payment = await Payment.findOne({ transactionId });
    if (!payment) {
      throw new ApiError(404, 'Payment not found');
    }
    
    await setCache(`payment:${transactionId}`, payment, 300);
    
    return payment;
  }
  
  async getUserPayments(userId, query = {}) {
    const cacheKey = `user:${userId}:payments:${JSON.stringify(query)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    
    const { page = 1, limit = 20, status } = query;
    
    const filter = { userId };
    if (status) filter.status = status;
    
    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Payment.countDocuments(filter);
    
    const result = {
      payments,
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
  
  async getPaymentStats() {
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    
    const todayStats = await Payment.aggregate([
      {
        $match: {
          createdAt: { $gte: today },
          status: 'completed'
        }
      },
      {
        $group: {
          _id: null,
          count: { $sum: 1 },
          total: { $sum: '$amount' }
        }
      }
    ]);
    
    const byMethod = await Payment.aggregate([
      {
        $match: { status: 'completed' }
      },
      {
        $group: {
          _id: '$paymentMethod',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    return {
      byStatus: stats,
      today: {
        count: todayStats[0]?.count || 0,
        total: todayStats[0]?.total || 0
      },
      byMethod,
      totalPayments: await Payment.countDocuments(),
      totalRevenue: await Payment.aggregate([
        { $match: { status: 'completed' } },
        { $group: { _id: null, total: { $sum: '$amount' } } }
      ]).then(r => r[0]?.total || 0)
    };
  }
}

module.exports = new PaymentService();