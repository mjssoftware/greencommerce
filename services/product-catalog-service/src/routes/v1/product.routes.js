const express = require('express');
const router = express.Router();
const productController = require('../../controllers/product.controller');
const { authMiddleware, requirePermission } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { cacheMiddleware } = require('../../middleware/cache');

// Public routes
router.get('/', cacheMiddleware(300, 'products'), productController.getAllProducts);
router.get('/search', productController.searchProducts);
router.get('/suggestions', productController.getProductSuggestions);
router.get('/featured', cacheMiddleware(1800, 'featured'), productController.getFeaturedProducts);
router.get('/stats', productController.getProductStats);
router.get('/:id', cacheMiddleware(3600, 'product'), productController.getProductById);
router.get('/slug/:slug', cacheMiddleware(3600, 'product'), productController.getProductBySlug);
router.get('/:id/related', productController.getRelatedProducts);

// Protected routes (require authentication)
router.use(authMiddleware);

// Admin only routes
router.post('/', requirePermission('product:write'), validate(schemas.createProduct), productController.createProduct);
router.put('/:id', requirePermission('product:write'), validate(schemas.updateProduct), productController.updateProduct);
router.delete('/:id', requirePermission('product:delete'), productController.deleteProduct);
router.put('/:productId/inventory', requirePermission('product:write'), productController.updateInventory);

module.exports = router;