const mongoose = require('mongoose');

const orderItemSchema = new mongoose.Schema({
  orderId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Order',
    required: true,
    index: true
  },
  productId: {
    type: String,
    required: true,
    index: true
  },
  sku: {
    type: String,
    required: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 1
  },
  price: {
    type: Number,
    required: true,
    min: 0
  },
  total: {
    type: Number,
    required: true
  },
  discount: {
    type: Number,
    default: 0
  },
  tax: {
    type: Number,
    default: 0
  },
  image: String,
  attributes: mongoose.Schema.Types.Mixed,
  status: {
    type: String,
    enum: ['pending', 'confirmed', 'shipped', 'delivered', 'cancelled', 'refunded'],
    default: 'pending'
  },
  refunded: {
    quantity: { type: Number, default: 0 },
    amount: { type: Number, default: 0 },
    reason: String
  }
}, {
  timestamps: true
});

// Indexes
orderItemSchema.index({ orderId: 1 });
orderItemSchema.index({ productId: 1 });

const OrderItem = mongoose.model('OrderItem', orderItemSchema);

module.exports = OrderItem;