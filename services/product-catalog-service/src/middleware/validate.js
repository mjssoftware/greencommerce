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
  createProduct: Joi.object({
    name: Joi.string().required().max(200),
    sku: Joi.string().required().uppercase(),
    description: Joi.string().required(),
    price: Joi.number().positive().required(),
    comparePrice: Joi.number().positive(),
    category: Joi.string().required(),
    brand: Joi.string(),
    inventory: Joi.object({
      quantity: Joi.number().min(0).default(0),
      lowStockThreshold: Joi.number().min(1).default(5),
      trackInventory: Joi.boolean().default(true)
    }),
    tags: Joi.array().items(Joi.string())
  }),
  
  updateProduct: Joi.object({
    name: Joi.string().max(200),
    description: Joi.string(),
    price: Joi.number().positive(),
    comparePrice: Joi.number().positive(),
    isActive: Joi.boolean(),
    isFeatured: Joi.boolean(),
    tags: Joi.array().items(Joi.string())
  }),
  
  createCategory: Joi.object({
    name: Joi.string().required().max(100),
    description: Joi.string(),
    parent: Joi.string().allow(null),
    isActive: Joi.boolean().default(true)
  }),
  
  createBrand: Joi.object({
    name: Joi.string().required().max(100),
    description: Joi.string(),
    website: Joi.string().uri(),
    isActive: Joi.boolean().default(true)
  })
};

module.exports = { validate, schemas };