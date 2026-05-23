const Joi = require('joi');

const validate = (schema) => {
  return (req, res, next) => {
    const { error } = schema.validate(req.body);
    
    if (error) {
      return res.status(400).json({
        success: false,
        message: 'Validation error',
        details: error.details.map(detail => detail.message)
      });
    }
    
    next();
  };
};

const schemas = {
  createInventory: Joi.object({
    productId: Joi.string().required(),
    sku: Joi.string().required().uppercase(),
    name: Joi.string().required(),
    quantity: Joi.number().min(0).default(0),
    lowStockThreshold: Joi.number().min(1).default(10),
    criticalStockThreshold: Joi.number().min(1).default(5),
    trackInventory: Joi.boolean().default(true),
    allowBackorders: Joi.boolean().default(false),
    location: Joi.object({
      warehouse: Joi.string(),
      aisle: Joi.string(),
      shelf: Joi.string(),
      bin: Joi.string()
    }),
    supplier: Joi.object({
      id: Joi.string(),
      name: Joi.string(),
      sku: Joi.string(),
      leadTime: Joi.number()
    })
  }),
  
  addStock: Joi.object({
    quantity: Joi.number().positive().required(),
    notes: Joi.string()
  }),
  
  deductStock: Joi.object({
    quantity: Joi.number().positive().required(),
    reason: Joi.string().required()
  }),
  
  checkAvailability: Joi.object({
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().positive().required()
      })
    ).min(1).required()
  }),
  
  reserveStock: Joi.object({
    orderId: Joi.string().required(),
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().required(),
        quantity: Joi.number().positive().required()
      })
    ).min(1).required()
  }),
  
  bulkUpdate: Joi.object({
    updates: Joi.array().items(
      Joi.object({
        productId: Joi.string().required(),
        operation: Joi.string().valid('add', 'deduct', 'set').required(),
        quantity: Joi.number().positive().required(),
        notes: Joi.string(),
        reason: Joi.string()
      })
    ).min(1).required()
  })
};

module.exports = { validate, schemas };