const Inventory = require('../models/Inventory.model');
const StockMovement = require('../models/StockMovement.model');

class InventoryRepository {
  async create(inventoryData) {
    const inventory = new Inventory(inventoryData);
    return await inventory.save();
  }
  
  async findByProductId(productId) {
    return await Inventory.findOne({ productId });
  }
  
  async findBySku(sku) {
    return await Inventory.findOne({ sku });
  }
  
  async findAll(filter = {}, page = 1, limit = 20) {
    const inventory = await Inventory.find(filter)
      .skip((page - 1) * limit)
      .limit(limit)
      .sort({ createdAt: -1 });
    
    const total = await Inventory.countDocuments(filter);
    
    return { inventory, total };
  }
  
  async update(productId, updateData) {
    return await Inventory.findOneAndUpdate(
      { productId },
      updateData,
      { new: true, runValidators: true }
    );
  }
  
  async updateStock(productId, quantityChange) {
    const inventory = await this.findByProductId(productId);
    if (!inventory) return null;
    
    inventory.quantity += quantityChange;
    return await inventory.save();
  }
  
  async getLowStock(threshold = 10) {
    return await Inventory.find({
      trackInventory: true,
      $expr: { $lte: ['$available', threshold] }
    });
  }
  
  async getOutOfStock() {
    return await Inventory.find({
      trackInventory: true,
      available: { $lte: 0 },
      allowBackorders: false
    });
  }
  
  async getStats() {
    const total = await Inventory.countDocuments();
    const totalValue = await Inventory.aggregate([
      { $match: { 'metadata.costPrice': { $exists: true } } },
      { $group: { _id: null, total: { $sum: { $multiply: ['$quantity', '$metadata.costPrice'] } } } }
    ]);
    
    return {
      totalProducts: total,
      totalValue: totalValue[0]?.total || 0
    };
  }
  
  async createMovement(movementData) {
    const movement = new StockMovement(movementData);
    return await movement.save();
  }
  
  async getMovements(productId, page = 1, limit = 50) {
    const movements = await StockMovement.find({ productId })
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await StockMovement.countDocuments({ productId });
    
    return { movements, total };
  }
}

module.exports = new InventoryRepository();