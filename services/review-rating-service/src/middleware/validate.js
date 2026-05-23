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
  createReview: Joi.object({
    productId: Joi.string().required(),
    orderId: Joi.string().required(),
    rating: Joi.number().min(1).max(5).required(),
    title: Joi.string().max(200).required(),
    content: Joi.string().min(10).max(2000).required(),
    images: Joi.array().items(
      Joi.object({
        url: Joi.string().uri(),
        caption: Joi.string(),
        order: Joi.number()
      })
    ).max(5),
    pros: Joi.array().items(Joi.string()),
    cons: Joi.array().items(Joi.string())
  }),
  
  updateReview: Joi.object({
    rating: Joi.number().min(1).max(5),
    title: Joi.string().max(200),
    content: Joi.string().min(10).max(2000),
    images: Joi.array().items(
      Joi.object({
        url: Joi.string().uri(),
        caption: Joi.string(),
        order: Joi.number()
      })
    ).max(5),
    pros: Joi.array().items(Joi.string()),
    cons: Joi.array().items(Joi.string())
  }),
  
  addReply: Joi.object({
    content: Joi.string().min(1).max(500).required()
  }),
  
  moderateReview: Joi.object({
    status: Joi.string().valid('approved', 'rejected', 'flagged').required(),
    notes: Joi.string().max(500)
  }),
  
  flagReview: Joi.object({
    reason: Joi.string().min(5).max(200).required()
  })
};

module.exports = { validate, schemas };