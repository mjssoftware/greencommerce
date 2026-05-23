const mongoose = require('mongoose');

const paymentSchema = new mongoose.Schema({
  transactionId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    index: true
  },
  orderNumber: {
    type: String,
    required: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  customer: {
    email: { type: String, required: true },
    name: { type: String, required: true },
    phone: String
  },
  amount: {
    type: Number,
    required: true,
    min: 0
  },
  currency: {
    type: String,
    default: 'ETB',
    uppercase: true
  },
  paymentMethod: {
    type: String,
    enum: ['chapa', 'tele birr', 'cbpay', 'ebirr', 'cash_on_delivery'],
    required: true
  },
  status: {
    type: String,
    enum: ['pending', 'processing', 'completed', 'failed', 'refunded', 'cancelled'],
    default: 'pending',
    index: true
  },
  providerData: {
    reference: String,
    checkoutUrl: String,
    paymentUrl: String,
    providerResponse: mongoose.Schema.Types.Mixed
  },
  paymentDetails: {
    paidAt: Date,
    paymentMethodDetails: String,
    transactionReference: String
  },
  refundDetails: {
    refundedAt: Date,
    refundAmount: Number,
    refundReason: String,
    refundId: String
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    returnUrl: String,
    callbackUrl: String,
    webhookData: mongoose.Schema.Types.Mixed
  },
  retryCount: {
    type: Number,
    default: 0
  },
  errorMessage: String,
  expiresAt: {
    type: Date,
    index: { expires: 0 }
  }
}, {
  timestamps: true
});

// Indexes
paymentSchema.index({ transactionId: 1 });
paymentSchema.index({ orderId: 1, status: 1 });
paymentSchema.index({ userId: 1, createdAt: -1 });
paymentSchema.index({ status: 1, createdAt: 1 });

// Virtual for isCompleted
paymentSchema.virtual('isCompleted').get(function() {
  return this.status === 'completed';
});

// Virtual for isRefunded
paymentSchema.virtual('isRefunded').get(function() {
  return this.status === 'refunded';
});

// Mark as completed
paymentSchema.methods.markCompleted = async function(providerData = {}) {
  this.status = 'completed';
  this.paymentDetails.paidAt = new Date();
  this.providerData = { ...this.providerData, ...providerData };
  await this.save();
};

// Mark as failed
paymentSchema.methods.markFailed = async function(error) {
  this.status = 'failed';
  this.errorMessage = error;
  this.retryCount += 1;
  await this.save();
};

// Mark as refunded
paymentSchema.methods.markRefunded = async function(amount, reason, refundId) {
  this.status = 'refunded';
  this.refundDetails = {
    refundedAt: new Date(),
    refundAmount: amount,
    refundReason: reason,
    refundId
  };
  await this.save();
};

const Payment = mongoose.model('Payment', paymentSchema);

module.exports = Payment;