const mongoose = require('mongoose');

const inventorySchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  sku: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  name: {
    type: String,
    required: true
  },
  quantity: {
    type: Number,
    required: true,
    min: 0,
    default: 0
  },
  reserved: {
    type: Number,
    default: 0,
    min: 0
  },
  available: {
    type: Number,
    default: 0
  },
  lowStockThreshold: {
    type: Number,
    default: 10
  },
  criticalStockThreshold: {
    type: Number,
    default: 5
  },
  trackInventory: {
    type: Boolean,
    default: true
  },
  allowBackorders: {
    type: Boolean,
    default: false
  },
  location: {
    warehouse: String,
    aisle: String,
    shelf: String,
    bin: String
  },
  supplier: {
    id: String,
    name: String,
    sku: String,
    leadTime: Number
  },
  reorderPoint: {
    type: Number,
    default: 0
  },
  reorderQuantity: {
    type: Number,
    default: 0
  },
  lastRestockedAt: Date,
  lastCountedAt: Date,
  status: {
    type: String,
    enum: ['active', 'discontinued', 'out_of_stock', 'low_stock'],
    default: 'active'
  },
  metadata: {
    costPrice: Number,
    sellingPrice: Number,
    weight: Number,
    dimensions: {
      length: Number,
      width: Number,
      height: Number
    }
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Virtual for available quantity
inventorySchema.virtual('availableQuantity').get(function() {
  return this.quantity - this.reserved;
});

// Virtual for isLowStock
inventorySchema.virtual('isLowStock').get(function() {
  return this.trackInventory && this.availableQuantity <= this.lowStockThreshold;
});

// Virtual for isCriticalStock
inventorySchema.virtual('isCriticalStock').get(function() {
  return this.trackInventory && this.availableQuantity <= this.criticalStockThreshold;
});

// Virtual for isOutOfStock
inventorySchema.virtual('isOutOfStock').get(function() {
  return this.trackInventory && this.availableQuantity <= 0 && !this.allowBackorders;
});

// Update available quantity before save
inventorySchema.pre('save', function(next) {
  this.available = this.quantity - this.reserved;
  
  // Update status based on quantity
  if (this.available <= 0) {
    this.status = 'out_of_stock';
  } else if (this.available <= this.lowStockThreshold) {
    this.status = 'low_stock';
  } else {
    this.status = 'active';
  }
  
  next();
});

// Method to check if enough stock available
inventorySchema.methods.hasStock = function(quantity) {
  if (!this.trackInventory) return true;
  return this.availableQuantity >= quantity;
};

// Method to reserve stock
inventorySchema.methods.reserve = async function(quantity, reservationId) {
  if (!this.hasStock(quantity)) {
    throw new Error(`Insufficient stock. Available: ${this.availableQuantity}, Requested: ${quantity}`);
  }
  
  this.reserved += quantity;
  await this.save();
  
  return true;
};

// Method to release reserved stock
inventorySchema.methods.release = async function(quantity) {
  if (this.reserved < quantity) {
    throw new Error(`Cannot release more than reserved. Reserved: ${this.reserved}, Requested: ${quantity}`);
  }
  
  this.reserved -= quantity;
  await this.save();
  
  return true;
};

// Method to confirm stock deduction (after payment)
inventorySchema.methods.confirmDeduction = async function(quantity) {
  if (this.reserved < quantity) {
    throw new Error(`Cannot confirm more than reserved. Reserved: ${this.reserved}, Requested: ${quantity}`);
  }
  
  this.quantity -= quantity;
  this.reserved -= quantity;
  await this.save();
  
  return true;
};

// Method to add stock
inventorySchema.methods.addStock = async function(quantity, notes) {
  this.quantity += quantity;
  this.lastRestockedAt = new Date();
  await this.save();
  
  return true;
};

// Method to deduct stock directly
inventorySchema.methods.deductStock = async function(quantity, reason) {
  if (this.quantity < quantity) {
    throw new Error(`Insufficient stock. Available: ${this.quantity}, Requested: ${quantity}`);
  }
  
  this.quantity -= quantity;
  await this.save();
  
  return true;
};

const Inventory = mongoose.model('Inventory', inventorySchema);

module.exports = Inventory;