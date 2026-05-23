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
  addItem: Joi.object({
    productId: Joi.string().required(),
    quantity: Joi.number().min(1).max(99).required(),
    attributes: Joi.object()
  }),
  
  updateQuantity: Joi.object({
    quantity: Joi.number().min(0).max(99).required()
  }),
  
  applyCoupon: Joi.object({
    couponCode: Joi.string().required().uppercase()
  })
};

module.exports = { validate, schemas };