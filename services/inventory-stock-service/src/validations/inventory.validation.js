const Joi = require('joi');

const inventoryValidation = {
  createInventory: Joi.object({
    productId: Joi.string().required(),
    sku: Joi.string().required().uppercase(),
    name: Joi.string().required().max(200),
    quantity: Joi.number().min(0).default(0),
    lowStockThreshold: Joi.number().min(1).default(10),
    criticalStockThreshold: Joi.number().min(1).default(5),
    trackInventory: Joi.boolean().default(true),
    allowBackorders: Joi.boolean().default(false),
    location: Joi.object({
      warehouse: Joi.string().max(50),
      aisle: Joi.string().max(20),
      shelf: Joi.string().max(20),
      bin: Joi.string().max(20)
    }),
    supplier: Joi.object({
      id: Joi.string(),
      name: Joi.string().max(100),
      sku: Joi.string(),
      leadTime: Joi.number().min(0)
    }),
    reorderPoint: Joi.number().min(0),
    reorderQuantity: Joi.number().min(0),
    metadata: Joi.object({
      costPrice: Joi.number().min(0),
      sellingPrice: Joi.number().min(0),
      weight: Joi.number().min(0),
      dimensions: Joi.object({
        length: Joi.number().min(0),
        width: Joi.number().min(0),
        height: Joi.number().min(0)
      })
    })
  }),
  
  updateInventory: Joi.object({
    name: Joi.string().max(200),
    lowStockThreshold: Joi.number().min(1),
    criticalStockThreshold: Joi.number().min(1),
    trackInventory: Joi.boolean(),
    allowBackorders: Joi.boolean(),
    location: Joi.object({
      warehouse: Joi.string().max(50),
      aisle: Joi.string().max(20),
      shelf: Joi.string().max(20),
      bin: Joi.string().max(20)
    }),
    supplier: Joi.object({
      id: Joi.string(),
      name: Joi.string().max(100),
      sku: Joi.string(),
      leadTime: Joi.number().min(0)
    }),
    reorderPoint: Joi.number().min(0),
    reorderQuantity: Joi.number().min(0),
    metadata: Joi.object({
      costPrice: Joi.number().min(0),
      sellingPrice: Joi.number().min(0),
      weight: Joi.number().min(0),
      dimensions: Joi.object({
        length: Joi.number().min(0),
        width: Joi.number().min(0),
        height: Joi.number().min(0)
      })
    }),
    notes: Joi.string()
  }),
  
  getInventory: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    search: Joi.string(),
    status: Joi.string().valid('active', 'discontinued', 'out_of_stock', 'low_stock'),
    lowStock: Joi.boolean(),
    sortBy: Joi.string().valid('name', 'sku', 'quantity', 'available', 'createdAt'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  }),
  
  getMovements: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(50),
    type: Joi.string().valid('reserve', 'release', 'confirm', 'add', 'deduct', 'adjust', 'return'),
    startDate: Joi.date(),
    endDate: Joi.date()
  })
};

module.exports = inventoryValidation;