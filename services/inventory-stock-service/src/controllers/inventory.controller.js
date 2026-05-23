const InventoryService = require('../services/inventory.service');
const StockReservationService = require('../services/stock-reservation.service');
const { ApiResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

class InventoryController {
  async createInventory(req, res, next) {
    try {
      const performedBy = req.user?.id || 'system';
      const inventory = await InventoryService.createInventory(req.body, performedBy);
      ApiResponse.success(res, {
        message: 'Inventory created successfully',
        data: inventory
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async getInventoryByProductId(req, res, next) {
    try {
      const inventory = await InventoryService.getInventoryByProductId(req.params.productId);
      ApiResponse.success(res, { data: inventory });
    } catch (error) {
      next(error);
    }
  }
  
  async getInventoryBySku(req, res, next) {
    try {
      const inventory = await InventoryService.getInventoryBySku(req.params.sku);
      ApiResponse.success(res, { data: inventory });
    } catch (error) {
      next(error);
    }
  }
  
  async getAllInventory(req, res, next) {
    try {
      const result = await InventoryService.getAllInventory(req.query);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async updateInventory(req, res, next) {
    try {
      const performedBy = req.user?.id || 'system';
      const inventory = await InventoryService.updateInventory(req.params.productId, req.body, performedBy);
      ApiResponse.success(res, {
        message: 'Inventory updated successfully',
        data: inventory
      });
    } catch (error) {
      next(error);
    }
  }
  
  async addStock(req, res, next) {
    try {
      const { productId } = req.params;
      const { quantity, notes } = req.body;
      const performedBy = req.user?.id || 'system';
      
      const inventory = await InventoryService.addStock(productId, quantity, notes, performedBy);
      ApiResponse.success(res, {
        message: 'Stock added successfully',
        data: inventory
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deductStock(req, res, next) {
    try {
      const { productId } = req.params;
      const { quantity, reason } = req.body;
      const performedBy = req.user?.id || 'system';
      
      const inventory = await InventoryService.deductStock(productId, quantity, reason, performedBy);
      ApiResponse.success(res, {
        message: 'Stock deducted successfully',
        data: inventory
      });
    } catch (error) {
      next(error);
    }
  }
  
  async checkAvailability(req, res, next) {
    try {
      const { items } = req.body;
      const results = await InventoryService.checkStockAvailability(items);
      ApiResponse.success(res, { data: results });
    } catch (error) {
      next(error);
    }
  }
  
  async reserveStock(req, res, next) {
    try {
      const { orderId, items } = req.body;
      const performedBy = req.user?.id || 'system';
      
      const result = await StockReservationService.reserveStock(orderId, items, performedBy);
      ApiResponse.success(res, {
        message: 'Stock reserved successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async releaseStock(req, res, next) {
    try {
      const { orderId, items } = req.body;
      const performedBy = req.user?.id || 'system';
      
      const result = await StockReservationService.releaseStock(orderId, items, performedBy);
      ApiResponse.success(res, {
        message: 'Stock released successfully',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async confirmReservation(req, res, next) {
    try {
      const { orderId, items } = req.body;
      const performedBy = req.user?.id || 'system';
      
      const result = await StockReservationService.confirmReservation(orderId, items, performedBy);
      ApiResponse.success(res, {
        message: 'Stock confirmation successful',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getLowStockProducts(req, res, next) {
    try {
      const products = await InventoryService.getLowStockProducts();
      ApiResponse.success(res, { data: products });
    } catch (error) {
      next(error);
    }
  }
  
  async getOutOfStockProducts(req, res, next) {
    try {
      const products = await InventoryService.getOutOfStockProducts();
      ApiResponse.success(res, { data: products });
    } catch (error) {
      next(error);
    }
  }
  
  async getInventoryStats(req, res, next) {
    try {
      const stats = await InventoryService.getInventoryStats();
      ApiResponse.success(res, { data: stats });
    } catch (error) {
      next(error);
    }
  }
  
  async getProductMovements(req, res, next) {
    try {
      const { productId } = req.params;
      const movements = await InventoryService.getProductMovements(productId, req.query);
      ApiResponse.success(res, movements);
    } catch (error) {
      next(error);
    }
  }
  
  async bulkUpdateInventory(req, res, next) {
    try {
      const { updates } = req.body;
      const performedBy = req.user?.id || 'system';
      
      const result = await InventoryService.bulkUpdateInventory(updates, performedBy);
      ApiResponse.success(res, {
        message: 'Bulk inventory update completed',
        data: result
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getReservationStatus(req, res, next) {
    try {
      const { orderId } = req.params;
      const status = await StockReservationService.getReservationStatus(orderId);
      ApiResponse.success(res, { data: status });
    } catch (error) {
      next(error);
    }
  }
  
  async cleanupExpiredReservations(req, res, next) {
    try {
      const cleaned = await StockReservationService.cleanupExpiredReservations();
      ApiResponse.success(res, {
        message: `Cleaned up ${cleaned.length} expired reservations`,
        data: { cleaned }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new InventoryController();