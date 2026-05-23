const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/api-error');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (!token) {
      throw new ApiError(401, 'Authentication required');
    }
    
    const decoded = jwt.verify(token, process.env.JWT_SECRET);
    req.user = decoded;
    
    next();
  } catch (error) {
    next(new ApiError(401, 'Invalid or expired token'));
  }
};

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    next();
  }
};

const requirePermission = (permission) => {
  return (req, res, next) => {
    if (!req.user) {
      throw new ApiError(401, 'Authentication required');
    }
    
    if (req.user.roles?.includes('admin') || req.user.permissions?.includes(permission)) {
      return next();
    }
    
    throw new ApiError(403, `Permission denied: ${permission} required`);
  };
};

module.exports = { authMiddleware, optionalAuthMiddleware, requirePermission };