// CartItem model structure
const CartItemSchema = {
  id: String,                    // Unique cart item ID
  productId: String,             // Product ID
  sku: String,                   // Product SKU
  name: String,                  // Product name
  quantity: Number,              // Quantity
  price: Number,                 // Current price
  originalPrice: Number,         // Original price
  total: Number,                 // Line total
  discount: Number,              // Discount amount
  image: String,                 // Product image URL
  attributes: {                  // Selected attributes
    size: String,
    color: String,
    // Other attributes
  },
  inStock: Boolean,
  maxQuantity: Number,
  addedAt: String,
  updatedAt: String
};

module.exports = { CartItemSchema };