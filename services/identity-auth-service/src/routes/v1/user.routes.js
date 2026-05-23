const express = require('express');
const router = express.Router();
const userController = require('../../controllers/user.controller');
const roleController = require('../../controllers/role.controller');
const { authMiddleware } = require('../../middleware/auth');
const { requirePermission, requireRole } = require('../../middleware/permission');
const { validate } = require('../../middleware/validate');
const userValidation = require('../../validations/user.validation');

// All routes require authentication
router.use(authMiddleware);

// User routes (self)
router.get('/me', userController.getMe);
router.put('/me', validate(userValidation.updateProfile), userController.updateUser);
router.delete('/me', userController.deleteUser);
router.get('/me/sessions', userController.getUserSessions);
router.delete('/me/sessions', userController.revokeAllSessions);
router.delete('/me/sessions/:tokenId', userController.revokeUserSession);

// Admin routes
router.get('/', requirePermission('user:read'), validate(userValidation.getUsers), userController.getAllUsers);
router.get('/stats', requirePermission('admin:users'), userController.getUserStats);
router.get('/search', requirePermission('user:read'), validate(userValidation.searchUsers), userController.searchUsers);
router.get('/:id', requirePermission('user:read'), validate(userValidation.userId), userController.getUserById);
router.put('/:id', requirePermission('user:write'), validate(userValidation.adminUpdateUser), userController.updateUser);
router.delete('/:id', requirePermission('user:delete'), validate(userValidation.userId), userController.deleteUser);
router.put('/:id/role', requirePermission('admin:roles'), validate(userValidation.updateUserRole), userController.updateUserRole);
router.get('/:id/sessions', requirePermission('user:read'), userController.getUserSessions);
router.delete('/:id/sessions', requirePermission('user:write'), userController.revokeAllSessions);

// Role routes (admin only)
router.get('/roles', requireRole('admin'), roleController.getAllRoles);
router.get('/roles/:id', requireRole('admin'), roleController.getRoleById);
router.post('/roles', requireRole('admin'), validate(schemas.createRole), roleController.createRole);
router.put('/roles/:id', requireRole('admin'), roleController.updateRole);
router.delete('/roles/:id', requireRole('admin'), roleController.deleteRole);
router.get('/roles/:id/permissions', requireRole('admin'), roleController.getRolePermissions);

module.exports = router;