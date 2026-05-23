const express = require('express');
const router = express.Router();
const brandController = require('../../controllers/brand.controller');
const { authMiddleware, requirePermission } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { cacheMiddleware } = require('../../middleware/cache');

// Public routes
router.get('/', cacheMiddleware(3600, 'brands'), brandController.getAllBrands);
router.get('/:id', cacheMiddleware(3600, 'brand'), brandController.getBrandById);
router.get('/slug/:slug', cacheMiddleware(3600, 'brand'), brandController.getBrandBySlug);
router.get('/:id/products', brandController.getBrandProducts);

// Admin only routes
router.use(authMiddleware);
router.post('/', requirePermission('product:write'), validate(schemas.createBrand), brandController.createBrand);
router.put('/:id', requirePermission('product:write'), brandController.updateBrand);
router.delete('/:id', requirePermission('product:delete'), brandController.deleteBrand);

module.exports = router;