const CartService = require('../services/cart.service');
const { ApiResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

class CartController {
  async getCart(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      
      const cart = await CartService.getCart(userId, sessionId);
      const expiry = await CartService.getCartExpiry(userId, sessionId);
      
      ApiResponse.success(res, {
        data: { cart, expiry }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async addItem(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      
      const cart = await CartService.addItem(userId, req.body, sessionId);
      
      ApiResponse.success(res, {
        message: 'Item added to cart successfully',
        data: cart
      });
    } catch (error) {
      next(error);
    }
  }
  
  async updateItemQuantity(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      const { itemId } = req.params;
      const { quantity } = req.body;
      
      const cart = await CartService.updateItemQuantity(userId, itemId, quantity, sessionId);
      
      ApiResponse.success(res, {
        message: 'Cart updated successfully',
        data: cart
      });
    } catch (error) {
      next(error);
    }
  }
  
  async removeItem(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      const { itemId } = req.params;
      
      const cart = await CartService.removeItem(userId, itemId, sessionId);
      
      ApiResponse.success(res, {
        message: 'Item removed from cart successfully',
        data: cart
      });
    } catch (error) {
      next(error);
    }
  }
  
  async clearCart(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      
      await CartService.clearCart(userId, sessionId);
      
      ApiResponse.success(res, {
        message: 'Cart cleared successfully'
      });
    } catch (error) {
      next(error);
    }
  }
  
  async applyCoupon(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      const { couponCode } = req.body;
      
      const cart = await CartService.applyCoupon(userId, couponCode, sessionId);
      
      ApiResponse.success(res, {
        message: 'Coupon applied successfully',
        data: cart
      });
    } catch (error) {
      next(error);
    }
  }
  
  async removeCoupon(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      
      const cart = await CartService.removeCoupon(userId, sessionId);
      
      ApiResponse.success(res, {
        message: 'Coupon removed successfully',
        data: cart
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getCartSummary(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      
      const summary = await CartService.getCartSummary(userId, sessionId);
      
      ApiResponse.success(res, { data: summary });
    } catch (error) {
      next(error);
    }
  }
  
  async getCartItemCount(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      
      const count = await CartService.getCartItemCount(userId, sessionId);
      
      ApiResponse.success(res, { data: { count } });
    } catch (error) {
      next(error);
    }
  }
  
  async mergeCart(req, res, next) {
    try {
      const userId = req.user?.id;
      const sessionId = req.headers['x-session-id'];
      
      if (!userId || !sessionId) {
        return ApiResponse.success(res, { 
          message: 'No guest cart to merge',
          data: { merged: false }
        });
      }
      
      const cart = await CartService.mergeCarts(userId, sessionId);
      
      ApiResponse.success(res, {
        message: 'Guest cart merged successfully',
        data: { merged: true, cart }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CartController();