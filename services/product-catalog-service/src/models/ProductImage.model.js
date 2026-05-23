const mongoose = require('mongoose');

const productImageSchema = new mongoose.Schema({
  productId: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'Product',
    required: true,
    index: true
  },
  url: {
    type: String,
    required: true
  },
  thumbnail: String,
  medium: String,
  large: String,
  alt: {
    type: String,
    trim: true
  },
  isPrimary: {
    type: Boolean,
    default: false
  },
  order: {
    type: Number,
    default: 0
  },
  size: Number,
  mimeType: String,
  uploadedBy: {
    type: mongoose.Schema.Types.ObjectId,
    ref: 'User'
  }
}, {
  timestamps: true
});

// Ensure only one primary image per product
productImageSchema.pre('save', async function(next) {
  if (this.isPrimary) {
    await this.constructor.updateMany(
      { productId: this.productId, _id: { $ne: this._id } },
      { isPrimary: false }
    );
  }
  next();
});

const ProductImage = mongoose.model('ProductImage', productImageSchema);

module.exports = ProductImage;