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
  createOrder: Joi.object({
    items: Joi.array().items(
      Joi.object({
        productId: Joi.string().required(),
        sku: Joi.string().required(),
        name: Joi.string().required(),
        quantity: Joi.number().min(1).required(),
        price: Joi.number().positive().required()
      })
    ).min(1).required(),
    customer: Joi.object({
      email: Joi.string().email().required(),
      name: Joi.string().required(),
      phone: Joi.string()
    }).required(),
    shipping: Joi.object({
      address: Joi.object({
        street: Joi.string().required(),
        city: Joi.string().required(),
        state: Joi.string().required(),
        country: Joi.string().required(),
        zipCode: Joi.string().required()
      }).required(),
      method: Joi.string().valid('standard', 'express', 'overnight').required()
    }).required(),
    discount: Joi.number().min(0),
    couponCode: Joi.string(),
    notes: Joi.string(),
    taxRate: Joi.number().min(0).max(1),
    shippingCost: Joi.number().min(0)
  }),
  
  updateOrderStatus: Joi.object({
    status: Joi.string().valid(
      'pending', 'confirmed', 'processing', 'shipped', 'delivered', 'cancelled'
    ).required(),
    note: Joi.string()
  }),
  
  updateShipping: Joi.object({
    trackingNumber: Joi.string().required(),
    carrier: Joi.string().required(),
    estimatedDelivery: Joi.date().required()
  }),
  
  cancelOrder: Joi.object({
    reason: Joi.string().required()
  }),
  
  transitionState: Joi.object({
    newStatus: Joi.string().valid(
      'pending', 'awaiting_payment', 'payment_processing', 'confirmed',
      'processing', 'shipped', 'delivered', 'cancelled', 'refunded'
    ).required(),
    metadata: Joi.object(),
    message: Joi.string()
  })
};

module.exports = { validate, schemas };