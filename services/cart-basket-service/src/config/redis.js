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
    
    redisClient.on('ready', () => {
      logger.info('Redis Client Ready');
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

// Cart specific Redis operations
const getCartKey = (userId, sessionId = null) => {
  if (userId) {
    return `cart:user:${userId}`;
  }
  return `cart:guest:${sessionId}`;
};

const getCart = async (userId, sessionId = null) => {
  try {
    const client = getRedisClient();
    const key = getCartKey(userId, sessionId);
    const cartData = await client.get(key);
    return cartData ? JSON.parse(cartData) : null;
  } catch (error) {
    logger.error('Redis get cart error:', error);
    return null;
  }
};

const setCart = async (userId, cartData, sessionId = null, ttl = null) => {
  try {
    const client = getRedisClient();
    const key = getCartKey(userId, sessionId);
    const ttlSeconds = ttl || (parseInt(process.env.CART_TTL_DAYS) * 24 * 60 * 60) || 604800;
    
    await client.setEx(key, ttlSeconds, JSON.stringify(cartData));
    return true;
  } catch (error) {
    logger.error('Redis set cart error:', error);
    return false;
  }
};

const deleteCart = async (userId, sessionId = null) => {
  try {
    const client = getRedisClient();
    const key = getCartKey(userId, sessionId);
    await client.del(key);
    return true;
  } catch (error) {
    logger.error('Redis delete cart error:', error);
    return false;
  }
};

const cartExists = async (userId, sessionId = null) => {
  try {
    const client = getRedisClient();
    const key = getCartKey(userId, sessionId);
    return await client.exists(key) === 1;
  } catch (error) {
    logger.error('Redis cart exists error:', error);
    return false;
  }
};

const getCartTTL = async (userId, sessionId = null) => {
  try {
    const client = getRedisClient();
    const key = getCartKey(userId, sessionId);
    return await client.ttl(key);
  } catch (error) {
    logger.error('Redis get cart TTL error:', error);
    return -1;
  }
};

module.exports = { 
  connectRedis, 
  getRedisClient, 
  getCart, 
  setCart, 
  deleteCart, 
  cartExists,
  getCartTTL,
  getCartKey
};