const express = require('express');
const router = express.Router();
const inventoryController = require('../../controllers/inventory.controller');
const { authMiddleware, requirePermission } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

// Public routes (limited info)
router.post('/check-availability', validate(schemas.checkAvailability), inventoryController.checkAvailability);

// Protected routes (require authentication)
router.use(authMiddleware);

// User routes
router.get('/reservation/:orderId', inventoryController.getReservationStatus);

// Admin routes
router.post('/', requirePermission('inventory:write'), validate(schemas.createInventory), inventoryController.createInventory);
router.get('/', requirePermission('inventory:read'), inventoryController.getAllInventory);
router.get('/low-stock', requirePermission('inventory:read'), inventoryController.getLowStockProducts);
router.get('/out-of-stock', requirePermission('inventory:read'), inventoryController.getOutOfStockProducts);
router.get('/stats', requirePermission('inventory:read'), inventoryController.getInventoryStats);
router.get('/product/:productId', requirePermission('inventory:read'), inventoryController.getInventoryByProductId);
router.get('/sku/:sku', requirePermission('inventory:read'), inventoryController.getInventoryBySku);
router.get('/product/:productId/movements', requirePermission('inventory:read'), inventoryController.getProductMovements);
router.put('/product/:productId', requirePermission('inventory:write'), validate(schemas.updateInventory), inventoryController.updateInventory);
router.post('/product/:productId/add-stock', requirePermission('inventory:write'), validate(schemas.addStock), inventoryController.addStock);
router.post('/product/:productId/deduct-stock', requirePermission('inventory:write'), validate(schemas.deductStock), inventoryController.deductStock);
router.post('/reserve', requirePermission('inventory:write'), validate(schemas.reserveStock), inventoryController.reserveStock);
router.post('/release', requirePermission('inventory:write'), validate(schemas.reserveStock), inventoryController.releaseStock);
router.post('/confirm', requirePermission('inventory:write'), validate(schemas.reserveStock), inventoryController.confirmReservation);
router.post('/bulk-update', requirePermission('inventory:write'), validate(schemas.bulkUpdate), inventoryController.bulkUpdateInventory);
router.post('/cleanup-reservations', requirePermission('inventory:admin'), inventoryController.cleanupExpiredReservations);

module.exports = router;