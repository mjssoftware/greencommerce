const Payment = require('../models/Payment.model');

class PaymentRepository {
  async create(paymentData) {
    const payment = new Payment(paymentData);
    return await payment.save();
  }
  
  async findByTransactionId(transactionId) {
    return await Payment.findOne({ transactionId });
  }
  
  async findByOrderId(orderId) {
    return await Payment.findOne({ orderId });
  }
  
  async findByUserId(userId, page = 1, limit = 20, status = null) {
    const filter = { userId };
    if (status) filter.status = status;
    
    const payments = await Payment.find(filter)
      .sort({ createdAt: -1 })
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Payment.countDocuments(filter);
    
    return { payments, total };
  }
  
  async updateStatus(transactionId, status, data = {}) {
    const payment = await Payment.findOne({ transactionId });
    if (!payment) return null;
    
    payment.status = status;
    Object.assign(payment, data);
    
    return await payment.save();
  }
  
  async getStats() {
    const stats = await Payment.aggregate([
      {
        $group: {
          _id: '$status',
          count: { $sum: 1 },
          totalAmount: { $sum: '$amount' }
        }
      }
    ]);
    
    return stats;
  }
  
  async getPendingPayments() {
    return await Payment.find({
      status: 'pending',
      expiresAt: { $gt: new Date() }
    });
  }
}

module.exports = new PaymentRepository();