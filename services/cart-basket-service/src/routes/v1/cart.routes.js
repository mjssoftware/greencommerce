const express = require('express');
const router = express.Router();
const cartController = require('../../controllers/cart.controller');
const { authMiddleware } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

// All cart routes use optional authentication
router.use(authMiddleware);

// Cart routes
router.get('/', cartController.getCart);
router.get('/summary', cartController.getCartSummary);
router.get('/count', cartController.getCartItemCount);
router.post('/items', validate(schemas.addItem), cartController.addItem);
router.put('/items/:itemId', validate(schemas.updateQuantity), cartController.updateItemQuantity);
router.delete('/items/:itemId', cartController.removeItem);
router.delete('/', cartController.clearCart);
router.post('/coupon', validate(schemas.applyCoupon), cartController.applyCoupon);
router.delete('/coupon', cartController.removeCoupon);
router.post('/merge', cartController.mergeCart);

module.exports = router;