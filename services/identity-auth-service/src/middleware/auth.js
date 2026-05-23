const TokenService = require('../services/token.service');
const { ApiError } = require('../utils/api-error');

const authMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      throw new ApiError(401, 'No token provided');
    }
    
    const token = authHeader.split(' ')[1];
    const decoded = await TokenService.validateAccessToken(token);
    
    req.user = {
      id: decoded.sub,
      email: decoded.email,
      roles: decoded.roles,
      permissions: decoded.permissions
    };
    
    next();
  } catch (error) {
    next(error);
  }
};

const optionalAuthMiddleware = async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      const token = authHeader.split(' ')[1];
      const decoded = await TokenService.validateAccessToken(token);
      req.user = {
        id: decoded.sub,
        email: decoded.email,
        roles: decoded.roles,
        permissions: decoded.permissions
      };
    }
    next();
  } catch (error) {
    // Don't throw error for optional auth
    next();
  }
};

module.exports = { authMiddleware, optionalAuthMiddleware };