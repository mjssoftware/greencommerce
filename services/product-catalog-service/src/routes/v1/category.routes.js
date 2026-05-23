const express = require('express');
const router = express.Router();
const categoryController = require('../../controllers/category.controller');
const { authMiddleware, requirePermission } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');
const { cacheMiddleware } = require('../../middleware/cache');

// Public routes
router.get('/', cacheMiddleware(3600, 'categories'), categoryController.getAllCategories);
router.get('/tree', cacheMiddleware(3600, 'category-tree'), categoryController.getCategoryTree);
router.get('/:id', cacheMiddleware(3600, 'category'), categoryController.getCategoryById);
router.get('/slug/:slug', cacheMiddleware(3600, 'category'), categoryController.getCategoryBySlug);
router.get('/:id/products', categoryController.getCategoryProducts);

// Admin only routes
router.use(authMiddleware);
router.post('/', requirePermission('product:write'), validate(schemas.createCategory), categoryController.createCategory);
router.put('/:id', requirePermission('product:write'), categoryController.updateCategory);
router.delete('/:id', requirePermission('product:delete'), categoryController.deleteCategory);

module.exports = router;