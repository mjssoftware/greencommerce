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
        logger.warn(`Redis retry attempt ${times}, delay: ${delay}ms`);
        return delay;
      },
      reconnectOnError: (err) => {
        logger.error('Redis reconnection error:', err);
        return true;
      }
    });
    
    redisClient.on('error', (err) => {
      logger.error('Redis Client Error:', err);
    });
    
    redisClient.on('connect', () => {
      logger.info('Redis Client Connected');
    });
    
    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
    });
    
    redisClient.on('reconnecting', () => {
      logger.warn('Redis Client Reconnecting');
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

const setCache = async (key, value, ttl = 3600) => {
  try {
    const client = getRedisClient();
    await client.setEx(key, ttl, JSON.stringify(value));
    return true;
  } catch (error) {
    logger.error('Redis set cache error:', error);
    return false;
  }
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

const blacklistToken = async (token, expiry) => {
  try {
    const client = getRedisClient();
    await client.setEx(`blacklist:${token}`, expiry, 'true');
    return true;
  } catch (error) {
    logger.error('Redis blacklist token error:', error);
    return false;
  }
};

const isTokenBlacklisted = async (token) => {
  try {
    const client = getRedisClient();
    const result = await client.get(`blacklist:${token}`);
    return result === 'true';
  } catch (error) {
    logger.error('Redis check blacklist error:', error);
    return false;
  }
};

module.exports = { 
  connectRedis, 
  getRedisClient, 
  setCache, 
  getCache, 
  deleteCache,
  blacklistToken,
  isTokenBlacklisted
};