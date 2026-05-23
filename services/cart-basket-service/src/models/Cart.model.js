// Cart model structure for Redis storage
// This is a conceptual model - actual storage is in Redis

const CartSchema = {
  // Meta information
  id: String,                    // Cart ID (same as user ID or session ID)
  userId: String,                // User ID (if authenticated)
  sessionId: String,             // Session ID (if guest)
  type: String,                  // 'user' or 'guest'
  
  // Cart items
  items: [{
    id: String,                  // Cart item ID
    productId: String,           // Product ID
    sku: String,                 // Product SKU
    name: String,                // Product name
    quantity: Number,            // Quantity
    price: Number,               // Current price
    originalPrice: Number,       // Original price (before discount)
    total: Number,               // Line total (price * quantity)
    discount: Number,            // Discount amount for this item
    image: String,               // Product image URL
    attributes: Object,          // Selected attributes (size, color, etc.)
    inStock: Boolean,            // Stock availability
    maxQuantity: Number,         // Maximum allowed quantity
    addedAt: String              // ISO timestamp
  }],
  
  // Cart summary
  summary: {
    subtotal: Number,            // Sum of all item totals
    discount: Number,            // Total discount
    tax: Number,                 // Tax amount
    shipping: Number,            // Shipping cost
    total: Number                // Grand total
  },
  
  // Coupon/Discount
  coupon: {
    code: String,
    discount: Number,
    type: String                 // 'percentage' or 'fixed'
  },
  
  // Metadata
  createdAt: String,
  updatedAt: String,
  expiresAt: String,
  itemCount: Number,             // Total number of items
  uniqueItemCount: Number        // Number of unique products
};

module.exports = { CartSchema };