const Joi = require('joi');

const authValidation = {
  register: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .message('Password must contain at least one uppercase letter, one lowercase letter, one number, and one special character'),
    firstName: Joi.string().min(2).max(50).required(),
    lastName: Joi.string().min(2).max(50).required(),
    phoneNumber: Joi.string().pattern(/^\+?[1-9]\d{1,14}$/),
    acceptTerms: Joi.boolean().valid(true).required()
  }),
  
  login: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    rememberMe: Joi.boolean().default(false)
  }),
  
  refreshToken: Joi.object({
    refreshToken: Joi.string().required()
  }),
  
  changePassword: Joi.object({
    oldPassword: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
  }),
  
  forgotPassword: Joi.object({
    email: Joi.string().email().required()
  }),
  
  resetPassword: Joi.object({
    token: Joi.string().required(),
    newPassword: Joi.string()
      .min(8)
      .pattern(/^(?=.*[a-z])(?=.*[A-Z])(?=.*\d)(?=.*[@$!%*?&])[A-Za-z\d@$!%*?&]{8,}$/)
      .required()
  }),
  
  verifyEmail: Joi.object({
    token: Joi.string().required()
  }),
  
  resendVerification: Joi.object({
    email: Joi.string().email().required()
  }),
  
  twoFactorSetup: Joi.object({
    password: Joi.string().required()
  }),
  
  twoFactorVerify: Joi.object({
    code: Joi.string().length(6).required()
  }),
  
  twoFactorLogin: Joi.object({
    email: Joi.string().email().required(),
    password: Joi.string().required(),
    twoFactorCode: Joi.string().length(6).required()
  })
};

module.exports = authValidation;