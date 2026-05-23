const { getCart, setCart, deleteCart, cartExists, getCartTTL, getCartKey } = require('../config/redis');
const logger = require('../utils/logger');

class CartRepository {
  async findCart(userId, sessionId = null) {
    return await getCart(userId, sessionId);
  }
  
  async saveCart(userId, cartData, sessionId = null, ttl = null) {
    return await setCart(userId, cartData, sessionId, ttl);
  }
  
  async deleteCart(userId, sessionId = null) {
    return await deleteCart(userId, sessionId);
  }
  
  async cartExists(userId, sessionId = null) {
    return await cartExists(userId, sessionId);
  }
  
  async getCartTTL(userId, sessionId = null) {
    return await getCartTTL(userId, sessionId);
  }
  
  async getCartKey(userId, sessionId = null) {
    return getCartKey(userId, sessionId);
  }
  
  async findUserCart(userId) {
    return await this.findCart(userId, null);
  }
  
  async findGuestCart(sessionId) {
    return await this.findCart(null, sessionId);
  }
  
  async deleteUserCart(userId) {
    return await this.deleteCart(userId, null);
  }
  
  async deleteGuestCart(sessionId) {
    return await this.deleteCart(null, sessionId);
  }
  
  async transferCart(sessionId, userId) {
    const guestCart = await this.findGuestCart(sessionId);
    if (!guestCart) {
      return null;
    }
    
    // Update cart to user cart
    guestCart.userId = userId;
    guestCart.type = 'user';
    guestCart.sessionId = null;
    
    await this.saveCart(userId, guestCart, null);
    await this.deleteGuestCart(sessionId);
    
    return guestCart;
  }
}

module.exports = new CartRepository();