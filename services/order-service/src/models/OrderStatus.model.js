const mongoose = require('mongoose');

const orderStatusSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    unique: true,
    index: true
  },
  history: [{
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
        'refunded'
      ],
      required: true
    },
    timestamp: {
      type: Date,
      default: Date.now
    },
    note: String,
    operator: String,
    metadata: mongoose.Schema.Types.Mixed
  }],
  current: {
    status: String,
    since: Date
  },
  estimated: {
    processing: Date,
    shipping: Date,
    delivery: Date
  }
}, {
  timestamps: true
});

// Update status
orderStatusSchema.methods.addStatus = async function(status, note, operator, metadata = {}) {
  this.history.push({ status, timestamp: new Date(), note, operator, metadata });
  this.current = { status, since: new Date() };
  await this.save();
};

const OrderStatus = mongoose.model('OrderStatus', orderStatusSchema);

module.exports = OrderStatus;