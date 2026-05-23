const { getCart, setCart, deleteCart, cartExists, getCartTTL } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const axios = require('axios');
const crypto = require('crypto');
const { v4: uuidv4 } = require('uuid');

class CartService {
  constructor() {
    this.maxCartItems = parseInt(process.env.MAX_CART_ITEMS) || 50;
    this.maxQuantityPerItem = parseInt(process.env.MAX_QUANTITY_PER_ITEM) || 99;
    this.cartTTL = (parseInt(process.env.CART_TTL_DAYS) || 7) * 24 * 60 * 60;
    this.guestCartTTL = (parseInt(process.env.GUEST_CART_TTL_HOURS) || 24) * 60 * 60;
  }

  async getOrCreateCart(userId, sessionId = null) {
    let cart = await getCart(userId, sessionId);
    
    if (!cart) {
      // Create new cart
      cart = {
        id: userId || sessionId,
        userId: userId || null,
        sessionId: sessionId || null,
        type: userId ? 'user' : 'guest',
        items: [],
        summary: {
          subtotal: 0,
          discount: 0,
          tax: 0,
          shipping: 0,
          total: 0
        },
        coupon: null,
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
        expiresAt: new Date(Date.now() + (userId ? this.cartTTL * 1000 : this.guestCartTTL * 1000)).toISOString(),
        itemCount: 0,
        uniqueItemCount: 0
      };
      
      const ttl = userId ? this.cartTTL : this.guestCartTTL;
      await setCart(userId, cart, sessionId, ttl);
    }
    
    return cart;
  }

  async addItem(userId, itemData, sessionId = null) {
    let cart = await this.getOrCreateCart(userId, sessionId);
    
    // Check cart size limit
    if (cart.uniqueItemCount >= this.maxCartItems) {
      throw new ApiError(400, `Cart cannot exceed ${this.maxCartItems} unique items`);
    }
    
    // Validate product
    const product = await this.validateProduct(itemData.productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Validate quantity
    if (itemData.quantity > this.maxQuantityPerItem) {
      throw new ApiError(400, `Maximum ${this.maxQuantityPerItem} items per product`);
    }
    
    // Check stock availability
    const stockCheck = await this.checkStock(itemData.productId, itemData.quantity);
    if (!stockCheck.available && !stockCheck.allowBackorders) {
      throw new ApiError(400, `Only ${stockCheck.available} items available in stock`);
    }
    
    // Check if item already exists in cart
    const existingItemIndex = cart.items.findIndex(
      item => item.productId === itemData.productId && 
              JSON.stringify(item.attributes) === JSON.stringify(itemData.attributes || {})
    );
    
    let newQuantity = itemData.quantity;
    let isNewItem = false;
    
    if (existingItemIndex !== -1) {
      // Update existing item
      newQuantity = cart.items[existingItemIndex].quantity + itemData.quantity;
      
      if (newQuantity > this.maxQuantityPerItem) {
        throw new ApiError(400, `Maximum ${this.maxQuantityPerItem} items per product`);
      }
      
      // Re-check stock for new total quantity
      const updatedStockCheck = await this.checkStock(itemData.productId, newQuantity);
      if (!updatedStockCheck.available && !updatedStockCheck.allowBackorders) {
        throw new ApiError(400, `Only ${updatedStockCheck.available} items available in stock`);
      }
      
      cart.items[existingItemIndex].quantity = newQuantity;
      cart.items[existingItemIndex].total = cart.items[existingItemIndex].price * newQuantity;
      cart.items[existingItemIndex].updatedAt = new Date().toISOString();
    } else {
      // Add new item
      const cartItem = {
        id: uuidv4(),
        productId: product.id,
        sku: product.sku,
        name: product.name,
        quantity: itemData.quantity,
        price: product.price,
        originalPrice: product.originalPrice || product.price,
        total: product.price * itemData.quantity,
        discount: product.discount || 0,
        image: product.image,
        attributes: itemData.attributes || {},
        inStock: stockCheck.available >= itemData.quantity,
        maxQuantity: Math.min(this.maxQuantityPerItem, stockCheck.available || this.maxQuantityPerItem),
        addedAt: new Date().toISOString(),
        updatedAt: new Date().toISOString()
      };
      
      cart.items.push(cartItem);
      isNewItem = true;
    }
    
    // Recalculate cart totals
    this.recalculateCart(cart);
    
    // Update cart metadata
    cart.updatedAt = new Date().toISOString();
    cart.itemCount = cart.items.reduce((sum, item) => sum + item.quantity, 0);
    cart.uniqueItemCount = cart.items.length;
    
    // Save cart
    const ttl = userId ? this.cartTTL : this.guestCartTTL;
    await setCart(userId, cart, sessionId, ttl);
    
    // Publish event
    await publishEvent('cart.events', 'cart.item.added', {
      eventId: crypto.randomUUID(),
      eventType: 'cart.item.added',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'cart-service',
      data: {
        userId: userId || sessionId,
        productId: itemData.productId,
        quantity: itemData.quantity,
        newQuantity: newQuantity,
        isNewItem
      }
    });
    
    return cart;
  }

  async updateItemQuantity(userId, itemId, quantity, sessionId = null) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    
    const itemIndex = cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new ApiError(404, 'Item not found in cart');
    }
    
    if (quantity <= 0) {
      // Remove item if quantity is 0 or negative
      return await this.removeItem(userId, itemId, sessionId);
    }
    
    if (quantity > this.maxQuantityPerItem) {
      throw new ApiError(400, `Maximum ${this.maxQuantityPerItem} items per product`);
    }
    
    // Check stock availability
    const item = cart.items[itemIndex];
    const stockCheck = await this.checkStock(item.productId, quantity);
    if (!stockCheck.available && !stockCheck.allowBackorders) {
      throw new ApiError(400, `Only ${stockCheck.available} items available in stock`);
    }
    
    // Update quantity
    cart.items[itemIndex].quantity = quantity;
    cart.items[itemIndex].total = item.price * quantity;
    cart.items[itemIndex].updatedAt = new Date().toISOString();
    cart.items[itemIndex].inStock = stockCheck.available >= quantity;
    cart.items[itemIndex].maxQuantity = Math.min(this.maxQuantityPerItem, stockCheck.available || this.maxQuantityPerItem);
    
    // Recalculate cart
    this.recalculateCart(cart);
    cart.updatedAt = new Date().toISOString();
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    
    // Save cart
    const ttl = userId ? this.cartTTL : this.guestCartTTL;
    await setCart(userId, cart, sessionId, ttl);
    
    // Publish event
    await publishEvent('cart.events', 'cart.item.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'cart.item.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'cart-service',
      data: {
        userId: userId || sessionId,
        productId: item.productId,
        oldQuantity: item.quantity,
        newQuantity: quantity
      }
    });
    
    return cart;
  }

  async removeItem(userId, itemId, sessionId = null) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    
    const itemIndex = cart.items.findIndex(item => item.id === itemId);
    if (itemIndex === -1) {
      throw new ApiError(404, 'Item not found in cart');
    }
    
    const removedItem = cart.items[itemIndex];
    cart.items.splice(itemIndex, 1);
    
    // Recalculate cart
    this.recalculateCart(cart);
    cart.updatedAt = new Date().toISOString();
    cart.itemCount = cart.items.reduce((sum, i) => sum + i.quantity, 0);
    cart.uniqueItemCount = cart.items.length;
    
    // Save cart
    const ttl = userId ? this.cartTTL : this.guestCartTTL;
    await setCart(userId, cart, sessionId, ttl);
    
    // Publish event
    await publishEvent('cart.events', 'cart.item.removed', {
      eventId: crypto.randomUUID(),
      eventType: 'cart.item.removed',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'cart-service',
      data: {
        userId: userId || sessionId,
        productId: removedItem.productId,
        quantity: removedItem.quantity
      }
    });
    
    return cart;
  }

  async getCart(userId, sessionId = null) {
    const cart = await getCart(userId, sessionId);
    
    if (!cart) {
      return {
        items: [],
        summary: {
          subtotal: 0,
          discount: 0,
          tax: 0,
          shipping: 0,
          total: 0
        },
        itemCount: 0,
        uniqueItemCount: 0
      };
    }
    
    // Refresh product prices and stock status
    await this.refreshCartItems(cart);
    
    return cart;
  }

  async clearCart(userId, sessionId = null) {
    await deleteCart(userId, sessionId);
    
    // Publish event
    await publishEvent('cart.events', 'cart.cleared', {
      eventId: crypto.randomUUID(),
      eventType: 'cart.cleared',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'cart-service',
      data: {
        userId: userId || sessionId
      }
    });
    
    return true;
  }

  async applyCoupon(userId, couponCode, sessionId = null) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    
    // Validate coupon
    const coupon = await this.validateCoupon(couponCode);
    if (!coupon || !coupon.valid) {
      throw new ApiError(400, coupon?.message || 'Invalid coupon code');
    }
    
    // Calculate discount
    let discountAmount = 0;
    if (coupon.type === 'percentage') {
      discountAmount = (cart.summary.subtotal * coupon.value) / 100;
      if (coupon.maxDiscount) {
        discountAmount = Math.min(discountAmount, coupon.maxDiscount);
      }
    } else if (coupon.type === 'fixed') {
      discountAmount = Math.min(coupon.value, cart.summary.subtotal);
    }
    
    cart.coupon = {
      code: couponCode,
      discount: discountAmount,
      type: coupon.type,
      details: coupon
    };
    
    // Recalculate totals with coupon
    this.recalculateCart(cart);
    cart.updatedAt = new Date().toISOString();
    
    // Save cart
    const ttl = userId ? this.cartTTL : this.guestCartTTL;
    await setCart(userId, cart, sessionId, ttl);
    
    return cart;
  }

  async removeCoupon(userId, sessionId = null) {
    const cart = await this.getOrCreateCart(userId, sessionId);
    
    cart.coupon = null;
    this.recalculateCart(cart);
    cart.updatedAt = new Date().toISOString();
    
    // Save cart
    const ttl = userId ? this.cartTTL : this.guestCartTTL;
    await setCart(userId, cart, sessionId, ttl);
    
    return cart;
  }

  async mergeCarts(userId, sessionId) {
    const guestCart = await getCart(null, sessionId);
    if (!guestCart) {
      return;
    }
    
    const userCart = await this.getOrCreateCart(userId);
    
    // Merge items
    for (const guestItem of guestCart.items) {
      const existingItemIndex = userCart.items.findIndex(
        item => item.productId === guestItem.productId && 
                JSON.stringify(item.attributes) === JSON.stringify(guestItem.attributes)
      );
      
      if (existingItemIndex !== -1) {
        // Update quantity
        userCart.items[existingItemIndex].quantity += guestItem.quantity;
        userCart.items[existingItemIndex].total = userCart.items[existingItemIndex].price * userCart.items[existingItemIndex].quantity;
        userCart.items[existingItemIndex].updatedAt = new Date().toISOString();
      } else {
        // Add new item
        userCart.items.push(guestItem);
      }
    }
    
    // Apply better coupon if any
    if (guestCart.coupon && !userCart.coupon) {
      userCart.coupon = guestCart.coupon;
    } else if (guestCart.coupon && userCart.coupon) {
      // Keep the better discount
      if (guestCart.coupon.discount > userCart.coupon.discount) {
        userCart.coupon = guestCart.coupon;
      }
    }
    
    // Recalculate cart
    this.recalculateCart(userCart);
    userCart.updatedAt = new Date().toISOString();
    userCart.itemCount = userCart.items.reduce((sum, i) => sum + i.quantity, 0);
    userCart.uniqueItemCount = userCart.items.length;
    
    // Save user cart
    await setCart(userId, userCart, null, this.cartTTL);
    
    // Delete guest cart
    await deleteCart(null, sessionId);
    
    // Publish merge event
    await publishEvent('cart.events', 'cart.merged', {
      eventId: crypto.randomUUID(),
      eventType: 'cart.merged',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'cart-service',
      data: {
        userId,
        guestItemsCount: guestCart.items.length,
        mergedItemsCount: userCart.items.length
      }
    });
    
    return userCart;
  }

  async getCartSummary(userId, sessionId = null) {
    const cart = await this.getCart(userId, sessionId);
    
    return {
      itemCount: cart.itemCount,
      uniqueItemCount: cart.uniqueItemCount,
      subtotal: cart.summary.subtotal,
      discount: cart.summary.discount,
      total: cart.summary.total,
      couponApplied: !!cart.coupon
    };
  }

  async getCartItemCount(userId, sessionId = null) {
    const cart = await getCart(userId, sessionId);
    return cart ? cart.itemCount : 0;
  }

  recalculateCart(cart) {
    // Calculate subtotal
    const subtotal = cart.items.reduce((sum, item) => sum + item.total, 0);
    
    // Calculate item discounts
    const itemDiscounts = cart.items.reduce((sum, item) => sum + (item.discount || 0), 0);
    
    // Apply coupon discount
    const couponDiscount = cart.coupon ? cart.coupon.discount : 0;
    
    const totalDiscount = itemDiscounts + couponDiscount;
    const discountedSubtotal = subtotal - totalDiscount;
    
    // Tax calculation (assuming 15% VAT for Ethiopia)
    const taxRate = 0.15;
    const tax = discountedSubtotal * taxRate;
    
    // Shipping (simplified - can be more complex based on items)
    const shipping = discountedSubtotal > 1000 ? 0 : 100;
    
    cart.summary = {
      subtotal: parseFloat(subtotal.toFixed(2)),
      discount: parseFloat(totalDiscount.toFixed(2)),
      tax: parseFloat(tax.toFixed(2)),
      shipping: parseFloat(shipping.toFixed(2)),
      total: parseFloat((discountedSubtotal + tax + shipping).toFixed(2))
    };
  }

  async validateProduct(productId) {
    try {
      const response = await axios.get(`${process.env.PRODUCT_SERVICE_URL}/api/v1/products/${productId}`);
      if (response.data.success) {
        const product = response.data.data;
        return {
          id: product._id,
          sku: product.sku,
          name: product.name,
          price: product.price,
          originalPrice: product.comparePrice,
          discount: product.discountPercentage ? (product.price * product.discountPercentage / 100) : 0,
          image: product.images?.find(img => img.isPrimary)?.url || product.images?.[0]?.url
        };
      }
      return null;
    } catch (error) {
      logger.error(`Failed to validate product ${productId}:`, error.message);
      return null;
    }
  }

  async checkStock(productId, quantity) {
    try {
      const response = await axios.post(`${process.env.INVENTORY_SERVICE_URL}/api/v1/inventory/check-availability`, {
        items: [{ productId, quantity }]
      });
      
      if (response.data.success && response.data.data[0]) {
        return {
          available: response.data.data[0].available,
          hasStock: response.data.data[0].hasStock,
          allowBackorders: response.data.data[0].allowBackorders || false
        };
      }
      return { available: 0, hasStock: false, allowBackorders: false };
    } catch (error) {
      logger.error(`Failed to check stock for ${productId}:`, error.message);
      return { available: quantity, hasStock: true, allowBackorders: true };
    }
  }

  async validateCoupon(couponCode) {
    // This would typically call a coupon service
    // For now, return mock validation
    const mockCoupons = {
      'WELCOME10': { type: 'percentage', value: 10, maxDiscount: 500, valid: true },
      'SAVE50': { type: 'fixed', value: 50, valid: true },
      'FREESHIP': { type: 'shipping', value: 100, valid: true }
    };
    
    const coupon = mockCoupons[couponCode.toUpperCase()];
    if (coupon) {
      return { ...coupon, valid: true, message: 'Coupon applied successfully' };
    }
    
    return { valid: false, message: 'Invalid or expired coupon code' };
  }

  async refreshCartItems(cart) {
    let needsUpdate = false;
    
    for (const item of cart.items) {
      // Refresh product price
      const product = await this.validateProduct(item.productId);
      if (product && product.price !== item.price) {
        item.price = product.price;
        item.total = item.price * item.quantity;
        needsUpdate = true;
      }
      
      // Refresh stock status
      const stockCheck = await this.checkStock(item.productId, item.quantity);
      if (stockCheck.hasStock !== item.inStock) {
        item.inStock = stockCheck.hasStock;
        item.maxQuantity = Math.min(this.maxQuantityPerItem, stockCheck.available || this.maxQuantityPerItem);
        needsUpdate = true;
      }
    }
    
    if (needsUpdate) {
      this.recalculateCart(cart);
      cart.updatedAt = new Date().toISOString();
    }
    
    return needsUpdate;
  }

  async getCartExpiry(userId, sessionId = null) {
    const ttl = await getCartTTL(userId, sessionId);
    if (ttl <= 0) {
      return null;
    }
    
    return {
      ttlSeconds: ttl,
      expiresAt: new Date(Date.now() + ttl * 1000).toISOString()
    };
  }
}

module.exports = new CartService();