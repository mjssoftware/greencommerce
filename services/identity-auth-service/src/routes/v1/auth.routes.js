const express = require('express');
const router = express.Router();
const authController = require('../../controllers/auth.controller');
const { validate, schemas } = require('../../middleware/validate');
const { authMiddleware } = require('../../middleware/auth');
const rateLimit = require('express-rate-limit');

// Rate limiters
const loginLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 5,
  message: 'Too many login attempts, please try again later'
});

const registerLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 10,
  message: 'Too many registration attempts, please try again later'
});

// Public routes
router.post('/register', registerLimiter, validate(schemas.register), authController.register);
router.post('/login', loginLimiter, validate(schemas.login), authController.login);
router.post('/refresh-token', validate(schemas.refreshToken), authController.refreshToken);
router.get('/verify-email', validate(schemas.verifyEmail), authController.verifyEmail);
router.post('/forgot-password', validate(schemas.forgotPassword), authController.forgotPassword);
router.post('/reset-password', validate(schemas.resetPassword), authController.resetPassword);

// Protected routes
router.use(authMiddleware);
router.post('/logout', authController.logout);
router.post('/change-password', validate(schemas.changePassword), authController.changePassword);
router.get('/me', authController.getMe);

module.exports = router;