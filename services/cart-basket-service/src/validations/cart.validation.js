const Joi = require('joi');

const cartValidation = {
  addItem: Joi.object({
    productId: Joi.string().required(),
    quantity: Joi.number().integer().min(1).max(99).required(),
    attributes: Joi.object({
      size: Joi.string(),
      color: Joi.string(),
      // Add other attributes as needed
    })
  }),
  
  updateQuantity: Joi.object({
    quantity: Joi.number().integer().min(0).max(99).required()
  }),
  
  applyCoupon: Joi.object({
    couponCode: Joi.string().required().uppercase().min(3).max(20)
  }),
  
  mergeCart: Joi.object({
    sessionId: Joi.string().required()
  })
};

module.exports = cartValidation;