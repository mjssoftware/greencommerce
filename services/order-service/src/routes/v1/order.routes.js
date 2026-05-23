const express = require('express');
const router = express.Router();
const orderController = require('../../controllers/order.controller');
const orderStatusController = require('../../controllers/order-status.controller');
const { authMiddleware, requirePermission } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

// All routes require authentication
router.use(authMiddleware);

// User routes
router.post('/', validate(schemas.createOrder), orderController.createOrder);
router.get('/my-orders', orderController.getUserOrders);
router.get('/:id', orderController.getOrderById);
router.post('/:id/cancel', validate(schemas.cancelOrder), orderController.cancelOrder);
router.get('/:id/timeline', orderController.getOrderTimeline);

// Admin routes
router.get('/admin/stats', requirePermission('order:read'), orderController.getOrderStats);
router.get('/admin/search', requirePermission('order:read'), orderController.searchOrders);
router.put('/admin/:id/status', requirePermission('order:write'), validate(schemas.updateOrderStatus), orderController.updateOrderStatus);
router.put('/admin/:id/shipping', requirePermission('order:write'), validate(schemas.updateShipping), orderController.updateShipping);
router.post('/admin/:id/transition', requirePermission('order:write'), validate(schemas.transitionState), orderController.transitionOrderState);

// Order status routes
router.get('/status/:orderId', orderStatusController.getOrderStatus);
router.put('/status/:orderId', requirePermission('order:write'), orderStatusController.updateOrderStatus);
router.get('/status/:orderId/history', orderStatusController.getStatusHistory);
router.get('/admin/metrics/status', requirePermission('order:read'), orderStatusController.getStatusMetrics);

module.exports = router;