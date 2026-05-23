const Joi = require('joi');

const userValidation = {
  updateProfile: Joi.object({
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    avatar: Joi.string().uri(),
    preferences: Joi.object({
      language: Joi.string().valid('en', 'es', 'fr', 'de', 'zh'),
      timezone: Joi.string(),
      currency: Joi.string().length(3),
      notifications: Joi.object({
        email: Joi.boolean(),
        sms: Joi.boolean(),
        push: Joi.boolean(),
        marketing: Joi.boolean()
      })
    })
  }),
  
  updateEmail: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required()
  }),
  
  updatePhone: Joi.object({
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/).required(),
    otpCode: Joi.string().length(6).required()
  }),
  
  adminUpdateUser: Joi.object({
    email: Joi.string().email(),
    firstName: Joi.string().min(2).max(50),
    lastName: Joi.string().min(2).max(50),
    phoneNumber: Joi.string(),
    roles: Joi.array().items(Joi.string()),
    status: Joi.string().valid('active', 'inactive', 'suspended'),
    emailVerified: Joi.boolean(),
    phoneVerified: Joi.boolean()
  }),
  
  userId: Joi.object({
    id: Joi.string().hex().length(24).required()
  }),
  
  searchUsers: Joi.object({
    q: Joi.string().min(1).required(),
    limit: Joi.number().min(1).max(50).default(10)
  }),
  
  getUsers: Joi.object({
    page: Joi.number().min(1).default(1),
    limit: Joi.number().min(1).max(100).default(20),
    search: Joi.string(),
    role: Joi.string(),
    status: Joi.string().valid('active', 'inactive', 'suspended', 'deleted'),
    sortBy: Joi.string().valid('createdAt', 'lastLogin', 'email'),
    sortOrder: Joi.string().valid('asc', 'desc').default('desc')
  })
};

module.exports = userValidation;