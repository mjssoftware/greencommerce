const redis = require('redis');
const logger = require('../utils/logger');

let redisClient = null;

const connectRedis = async () => {
  try {
    redisClient = redis.createClient({
      url: `redis://${process.env.REDIS_HOST}:${process.env.REDIS_PORT}`,
      password: process.env.REDIS_PASSWORD,
      retryStrategy: (times) => {
        const delay = Math.min(times * 50, 2000);
        return delay;
      }
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });
    
    await redisClient.connect();
    
    return redisClient;
  } catch (error) {
    logger.error('Redis connection failed:', error);
    throw error;
  }
};

const getRedisClient = () => {
  if (!redisClient) {
    throw new Error('Redis client not initialized');
  }
  return redisClient;
};

const getCache = async (key) => {
  try {
    const client = getRedisClient();
    const data = await client.get(key);
    return data ? JSON.parse(data) : null;
  } catch (error) {
    logger.error('Redis get cache error:', error);
    return null;
  }
};

const setCache = async (key, value, ttl = process.env.CACHE_TTL || 3600) => {
  try {
    const client = getRedisClient();
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis set cache error:', error);
    return false;
  }
};

const deleteCache = async (pattern) => {
  try {
    const client = getRedisClient();
    const keys = await client.keys(pattern);
    if (keys.length > 0) {
      await client.del(keys);
    }
    return true;
  } catch (error) {
    logger.error('Redis delete cache error:', error);
    return false;
  }
};

module.exports = { connectRedis, getRedisClient, getCache, setCache, deleteCache };