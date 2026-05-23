const mongoose = require('mongoose');

const orderSchema = new mongoose.Schema({
  orderNumber: {
    type: String,
    required: true,
    unique: true,
    index: true
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
  items: [{
    productId: { type: String, required: true },
    sku: { type: String, required: true },
    name: { type: String, required: true },
    quantity: { type: Number, required: true, min: 1 },
    price: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true },
    image: String
  }],
  summary: {
    subtotal: { type: Number, required: true, min: 0 },
    discount: { type: Number, default: 0, min: 0 },
    tax: { type: Number, required: true, min: 0 },
    shipping: { type: Number, required: true, min: 0 },
    total: { type: Number, required: true, min: 0 }
  },
  status: {
    type: String,
    enum: [
      'pending',
      'awaiting_payment',
      'payment_processing',
      'payment_failed',
      'confirmed',
      'processing',
      'shipped',
      'delivered',
      'cancelled',
      'refunded',
      'failed'
    ],
    default: 'pending',
    index: true
  },
  payment: {
    transactionId: String,
    paymentMethod: String,
    paymentStatus: {
      type: String,
      enum: ['pending', 'processing', 'completed', 'failed', 'refunded']
    },
    amount: Number,
    paidAt: Date,
    refundAmount: Number,
    refundReason: String
  },
  shipping: {
    address: {
      street: String,
      city: String,
      state: String,
      country: String,
      zipCode: String
    },
    method: String,
    trackingNumber: String,
    carrier: String,
    estimatedDelivery: Date,
    shippedAt: Date,
    deliveredAt: Date
  },
  timeline: [{
    status: String,
    message: String,
    timestamp: { type: Date, default: Date.now },
    metadata: mongoose.Schema.Types.Mixed
  }],
  saga: {
    step: {
      type: String,
      enum: ['init', 'reserve_inventory', 'process_payment', 'complete', 'failed']
    },
    context: mongoose.Schema.Types.Mixed,
    compensationAttempts: { type: Number, default: 0 }
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    couponCode: String,
    notes: String
  },
  expiresAt: {
    type: Date,
    index: { expires: 0 }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
orderSchema.index({ userId: 1, createdAt: -1 });
orderSchema.index({ status: 1, createdAt: -1 });
orderSchema.index({ 'payment.transactionId': 1 });

// Generate order number before saving
orderSchema.pre('save', async function(next) {
  if (!this.orderNumber) {
    const date = new Date();
    const year = date.getFullYear();
    const month = String(date.getMonth() + 1).padStart(2, '0');
    const count = await this.constructor.countDocuments() + 1;
    this.orderNumber = `ORD-${year}${month}-${String(count).padStart(6, '0')}`;
  }
  next();
});

// Virtual for isPaid
orderSchema.virtual('isPaid').get(function() {
  return this.payment.paymentStatus === 'completed';
});

// Virtual for isShipped
orderSchema.virtual('isShipped').get(function() {
  return this.status === 'shipped';
});

// Virtual for canCancel
orderSchema.virtual('canCancel').get(function() {
  return ['pending', 'awaiting_payment', 'confirmed'].includes(this.status);
});

// Add timeline entry
orderSchema.methods.addTimelineEntry = async function(status, message, metadata = {}) {
  this.timeline.push({ status, message, metadata, timestamp: new Date() });
  this.status = status;
  await this.save();
};

// Update payment status
orderSchema.methods.updatePayment = async function(transactionId, status, amount) {
  this.payment.transactionId = transactionId;
  this.payment.paymentStatus = status;
  this.payment.amount = amount;
  if (status === 'completed') {
    this.payment.paidAt = new Date();
  }
  await this.save();
};

// Update shipping
orderSchema.methods.updateShipping = async function(trackingNumber, carrier, estimatedDelivery) {
  this.shipping.trackingNumber = trackingNumber;
  this.shipping.carrier = carrier;
  this.shipping.estimatedDelivery = estimatedDelivery;
  await this.save();
};

// Cancel order
orderSchema.methods.cancel = async function(reason) {
  if (!this.canCancel) {
    throw new Error(`Cannot cancel order in ${this.status} status`);
  }
  
  this.status = 'cancelled';
  this.metadata.cancelReason = reason;
  await this.addTimelineEntry('cancelled', `Order cancelled: ${reason}`);
};

const Order = mongoose.model('Order', orderSchema);

module.exports = Order;