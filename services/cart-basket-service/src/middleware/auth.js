const jwt = require('jsonwebtoken');
const { ApiError } = require('../utils/api-error');

const authMiddleware = async (req, res, next) => {
  try {
    const token = req.headers.authorization?.split(' ')[1];
    
    if (token) {
      const decoded = jwt.verify(token, process.env.JWT_SECRET);
      req.user = decoded;
    }
    
    next();
  } catch (error) {
    // Don't block requests if token is invalid, just treat as guest
    next();
  }
};

const optionalAuthMiddleware = (req, res, next) => {
  next();
};

module.exports = { authMiddleware, optionalAuthMiddleware };