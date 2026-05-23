const { getCache, setCache } = require('../config/redis');
const logger = require('../utils/logger');

const cacheMiddleware = (duration = 3600, keyPrefix = '') => {
  return async (req, res, next) => {
    try {
      const key = `${keyPrefix}:${req.originalUrl || req.url}`;
      const cachedData = await getCache(key);
      
      if (cachedData) {
        return res.json(cachedData);
      }
      
      // Store original json method
      const originalJson = res.json;
      
      // Override json method
      res.json = function(data) {
        if (res.statusCode === 200) {
          setCache(key, data, duration).catch(err => {
            logger.error('Failed to cache response:', err);
          });
        }
        originalJson.call(this, data);
      };
      
      next();
    } catch (error) {
      logger.error('Cache middleware error:', error);
      next();
    }
  };
};

module.exports = { cacheMiddleware };