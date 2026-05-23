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
  initializePayment: Joi.object({
    orderId: Joi.string().required(),
    orderNumber: Joi.string().required(),
    amount: Joi.number().positive().required(),
    currency: Joi.string().default('ETB'),
    paymentMethod: Joi.string().valid('chapa', 'tele birr', 'cash_on_delivery').required(),
    customer: Joi.object({
      email: Joi.string().email().required(),
      name: Joi.string().required(),
      phone: Joi.string()
    }).required(),
    returnUrl: Joi.string().uri()
  }),
  
  refundPayment: Joi.object({
    amount: Joi.number().positive(),
    reason: Joi.string().required()
  })
};

module.exports = { validate, schemas };