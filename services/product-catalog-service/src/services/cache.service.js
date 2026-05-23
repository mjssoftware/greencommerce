const { getCache, setCache, deleteCache } = require('../config/redis');
const logger = require('../utils/logger');

class CacheService {
  async getOrSet(key, fetcher, ttl = 3600, forceRefresh = false) {
    if (!forceRefresh) {
      const cached = await getCache(key);
      if (cached) return cached;
    }
    
    const data = await fetcher();
    await setCache(key, data, ttl);
    return data;
  }
  
  async invalidatePattern(pattern) {
    await deleteCache(pattern);
    logger.info(`Cache invalidated for pattern: ${pattern}`);
  }
  
  async invalidateProduct(productId) {
    await Promise.all([
      deleteCache(`product:${productId}`),
      deleteCache(`product:slug:*`),
      deleteCache('products:list:*'),
      deleteCache('products:featured')
    ]);
    logger.info(`Product cache invalidated: ${productId}`);
  }
  
  async invalidateCategory(categoryId) {
    await Promise.all([
      deleteCache(`category:${categoryId}`),
      deleteCache(`category:tree`),
      deleteCache('categories:list:*'),
      deleteCache('products:list:*')
    ]);
  }
  
  async invalidateBrand(brandId) {
    await Promise.all([
      deleteCache(`brand:${brandId}`),
      deleteCache('brands:list:*'),
      deleteCache('products:list:*')
    ]);
  }
}

module.exports = new CacheService();