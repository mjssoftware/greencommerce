const express = require('express');
const router = express.Router();
const paymentController = require('../../controllers/payment.controller');
const { authMiddleware, requirePermission } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

// Protected routes (require authentication)
router.use(authMiddleware);

// User routes
router.post('/initialize', validate(schemas.initializePayment), paymentController.initializePayment);
router.get('/verify/:transactionId', paymentController.verifyPayment);
router.get('/status/:transactionId', paymentController.getPaymentStatus);
router.get('/my-payments', paymentController.getUserPayments);

// Admin routes
router.post('/refund/:transactionId', requirePermission('payment:write'), validate(schemas.refundPayment), paymentController.refundPayment);
router.get('/admin/stats', requirePermission('payment:read'), paymentController.getPaymentStats);

module.exports = router;