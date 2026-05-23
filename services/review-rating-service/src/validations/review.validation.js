const Joi = require('joi');

const reviewValidation = {
  createReview: Joi.object({
    productId: Joi.string().required(),
    orderId: Joi.string().required(),
    rating: Joi.number().integer().min(1).max(5).required(),
    title: Joi.string().max(200).required(),
    content: Joi.string().min(10).max(2000).required(),
    images: Joi.array().items(
      Joi.object({
        url: Joi.string().uri(),
        caption: Joi.string().max(100),
        order: Joi.number().integer().min(0)
      })
    ).max(5),
    pros: Joi.array().items(Joi.string().max(100)),
    cons: Joi.array().items(Joi.string().max(100))
  }),
  
  getReviews: Joi.object({
    page: Joi.number().integer().min(1).default(1),
    limit: Joi.number().integer().min(1).max(100).default(20),
    rating: Joi.number().integer().min(1).max(5),
    sentiment: Joi.string().valid('positive', 'neutral', 'negative'),
    hasImages: Joi.boolean(),
    hasPros: Joi.boolean(),
    hasCons: Joi.boolean(),
    verified: Joi.boolean(),
    sortBy: Joi.string().valid('rating', 'createdAt', 'helpfulVotes'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
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

module.exports = reviewValidation;