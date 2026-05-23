const mongoose = require('mongoose');
const slugify = require('slugify');

const productSchema = new mongoose.Schema({
  name: {
    type: String,
    required: [true, 'Product name is required'],
    trim: true,
    maxlength: [200, 'Product name cannot exceed 200 characters'],
    index: true
  },
  slug: {
    type: String,
    unique: true,
    lowercase: true
  },
  sku: {
    type: String,
    required: [true, 'SKU is required'],
    unique: true,
    uppercase: true,
    trim: true
  },
  description: {
    type: String,
    required: [true, 'Product description is required'],
    trim: true
  },
  shortDescription: {
    type: String,
    maxlength: [500, 'Short description cannot exceed 500 characters']
  },
  price: {
    type: Number,
    required: [true, 'Product price is required'],
    min: [0, 'Price cannot be negative'],
    set: v => parseFloat(v).toFixed(2)
  },
  comparePrice: {
    type: Number,
    min: [0, 'Compare price cannot be negative'],
    set: v => v ? parseFloat(v).toFixed(2) : null
  },
  costPerItem: {
    type: Number,
    min: [0, 'Cost per item cannot be negative']
  },
  category: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Category',
    required: [true, 'Category is required']
  },
  brand: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Brand'
  },
  images: [{
    url: String,
    alt: String,
    isPrimary: { type: Boolean, default: false },
    order: Number
  }],
  attributes: [{
    name: String,
    value: String,
    visible: { type: Boolean, default: true }
  }],
  variants: [{
    sku: { type: String, unique: true },
    attributes: Map,
    price: Number,
    comparePrice: Number,
    inventory: { type: Number, default: 0 },
    images: [String]
  }],
  tags: [{
    type: String,
    trim: true,
    lowercase: true
  }],
  weight: {
    value: Number,
    unit: { type: String, enum: ['kg', 'g', 'lb', 'oz'], default: 'kg' }
  },
  dimensions: {
    length: Number,
    width: Number,
    height: Number,
    unit: { type: String, enum: ['cm', 'in'], default: 'cm' }
  },
  inventory: {
    quantity: { type: Number, default: 0, min: 0 },
    reserved: { type: Number, default: 0 },
    lowStockThreshold: { type: Number, default: 5 },
    trackInventory: { type: Boolean, default: true },
    allowBackorders: { type: Boolean, default: false }
  },
  shipping: {
    weight: Number,
    freeShipping: { type: Boolean, default: false },
    internationalShipping: { type: Boolean, default: true },
    estimatedDays: [Number]
  },
  seo: {
    title: String,
    description: String,
    keywords: [String]
  },
  isActive: {
    type: Boolean,
    default: true,
    index: true
  },
  isFeatured: {
    type: Boolean,
    default: false
  },
  isDigital: {
    type: Boolean,
    default: false
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  totalSold: {
    type: Number,
    default: 0
  },
  views: {
    type: Number,
    default: 0
  },
  createdBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  },
  updatedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
productSchema.index({ name: 'text', description: 'text', tags: 'text' });
productSchema.index({ price: 1, createdAt: -1 });
productSchema.index({ category: 1, isActive: 1 });
productSchema.index({ brand: 1 });
productSchema.index({ 'variants.sku': 1 });

// Generate slug before saving
productSchema.pre('save', function(next) {
  if (this.isModified('name')) {
    this.slug = slugify(this.name, { lower: true, strict: true });
  }
  next();
});

// Virtual for discount percentage
productSchema.virtual('discountPercentage').get(function() {
  if (this.comparePrice && this.comparePrice > this.price) {
    return Math.round(((this.comparePrice - this.price) / this.comparePrice) * 100);
  }
  return 0;
});

// Virtual for available quantity
productSchema.virtual('availableQuantity').get(function() {
  return this.inventory.quantity - this.inventory.reserved;
});

// Check if product is in stock
productSchema.virtual('inStock').get(function() {
  if (!this.inventory.trackInventory) return true;
  return this.availableQuantity > 0 || this.inventory.allowBackorders;
});

// Method to reduce inventory
productSchema.methods.reduceInventory = async function(quantity) {
  if (this.inventory.trackInventory) {
    if (this.availableQuantity < quantity && !this.inventory.allowBackorders) {
      throw new Error('Insufficient inventory');
    }
    this.inventory.reserved += quantity;
    await this.save();
  }
  return true;
};

// Method to confirm inventory deduction
productSchema.methods.confirmInventoryDeduction = async function(quantity) {
  if (this.inventory.trackInventory) {
    this.inventory.quantity -= quantity;
    this.inventory.reserved -= quantity;
    this.totalSold += quantity;
    await this.save();
  }
  return true;
};

// Method to release reserved inventory
productSchema.methods.releaseInventory = async function(quantity) {
  if (this.inventory.trackInventory) {
    this.inventory.reserved -= quantity;
    await this.save();
  }
  return true;
};

// Update rating
productSchema.methods.updateRating = async function(newRating) {
  const total = (this.averageRating * this.totalReviews) + newRating;
  this.totalReviews += 1;
  this.averageRating = total / this.totalReviews;
  await this.save();
};

const Product = mongoose.model('Product', productSchema);

module.exports = Product;