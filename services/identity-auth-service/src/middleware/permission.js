const { ApiError } = require('../utils/api-error');

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    
    // Admin has all permissions
    if (req.user.roles.includes('admin')) {
      return next();
    }
    
    // Check if user has the required permission
    if (req.user.permissions.includes('*') || req.user.permissions.includes(permission)) {
      return next();
    }
    
    throw new ApiError(403, `Permission denied: ${permission} required`);
  };
};

const requireRole = (...roles) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    
    const hasRole = req.user.roles.some(role => roles.includes(role));
    if (hasRole) {
      return next();
    }
    
    throw new ApiError(403, `Role required: ${roles.join(', ')}`);
  };
};

const requireOwnership = (getResourceUserId) => {
  return async (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    
    // Admin can access any resource
    if (req.user.roles.includes('admin')) {
      return next();
    }
    
    const resourceUserId = await getResourceUserId(req);
    if (req.user.id === resourceUserId) {
      return next();
    }
    
    throw new ApiError(403, 'You can only access your own resources');
  };
};

module.exports = { requirePermission, requireRole, requireOwnership };