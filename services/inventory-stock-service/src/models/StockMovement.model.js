const mongoose = require('mongoose');

const stockMovementSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    index: true
  },
  type: {
    type: String,
    enum: ['reserve', 'release', 'confirm', 'add', 'deduct', 'adjust', 'return'],
    required: true
  },
  quantity: {
    type: Number,
    required: true
  },
  previousQuantity: {
    type: Number,
    required: true
  },
  newQuantity: {
    type: Number,
    required: true
  },
  previousReserved: Number,
  newReserved: Number,
  reference: {
    type: String,
    index: true
  },
      referenceType: {
      type: String,
      enum: ['order', 'reservation', 'purchase_order', 'return', 'adjustment'],
      required: true
  },
  status: {
    type: String,
    enum: ['pending', 'completed', 'failed', 'reversed'],
    default: 'completed'
  },
  performedBy: {
    type: String,
    required: true
  },
  performedByRole: {
    type: String,
    enum: ['system', 'admin', 'customer', 'warehouse'],
    default: 'system'
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    notes: String,
    reason: String
  },
  batchId: {
    type: String,
    index: true
  },
  createdAt: {
    type: Date,
    default: Date.now,
    index: true
  }
}, {
  timestamps: true
});

// Indexes
stockMovementSchema.index({ productId: 1, createdAt: -1 });
stockMovementSchema.index({ reference: 1 });
stockMovementSchema.index({ batchId: 1 });
stockMovementSchema.index({ type: 1, createdAt: -1 });

// Static method to get movement summary
stockMovementSchema.statics.getSummary = async function(productId, days = 30) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const summary = await this.aggregate([
    {
      $match: {
        productId: productId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: '$type',
        totalQuantity: { $sum: '$quantity' },
        count: { $sum: 1 }
      }
    }
  ]);
  
  return summary;
};

// Static method to get daily movements
stockMovementSchema.statics.getDailyMovements = async function(productId, days = 7) {
  const startDate = new Date();
  startDate.setDate(startDate.getDate() - days);
  
  const movements = await this.aggregate([
    {
      $match: {
        productId: productId,
        createdAt: { $gte: startDate }
      }
    },
    {
      $group: {
        _id: {
          date: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
          type: "$type"
        },
        totalQuantity: { $sum: "$quantity" },
        count: { $sum: 1 }
      }
    },
    {
      $sort: { "_id.date": -1 }
    }
  ]);
  
  return movements;
};

const StockMovement = mongoose.model('StockMovement', stockMovementSchema);

module.exports = StockMovement;