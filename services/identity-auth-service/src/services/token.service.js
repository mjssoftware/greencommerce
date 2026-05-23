const RefreshToken = require('../models/RefreshToken.model');
const { blacklistToken, isTokenBlacklisted } = require('../config/redis');
const { verifyAccessToken } = require('../config/jwt');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');

class TokenService {
  async revokeAllUserTokens(userId, reason = 'admin') {
    const result = await RefreshToken.updateMany(
      { userId, revoked: false },
      {
        revoked: true,
        revokedAt: new Date(),
        revokedReason: reason
      }
    );
    
    logger.info(`Revoked ${result.modifiedCount} tokens for user ${userId}`);
    return result.modifiedCount;
  }
  
  async getUserActiveSessions(userId) {
    const tokens = await RefreshToken.find({
      userId,
      revoked: false,
      expiresAt: { $gt: new Date() }
    }).sort({ createdAt: -1 });
    
    return tokens.map(token => ({
      id: token._id,
      userAgent: token.userAgent,
      ipAddress: token.ipAddress,
      createdAt: token.createdAt,
      expiresAt: token.expiresAt
    }));
  }
  
  async revokeSpecificToken(tokenId, userId) {
    const token = await RefreshToken.findOne({ _id: tokenId, userId });
    if (!token) {
      throw new ApiError(404, 'Token not found');
    }
    
    token.revoked = true;
    token.revokedAt = new Date();
    token.revokedReason = 'user';
    await token.save();
    
    return true;
  }
  
  async validateAccessToken(token) {
    // Check if token is blacklisted
    const isBlacklisted = await isTokenBlacklisted(token);
    if (isBlacklisted) {
      throw new ApiError(401, 'Token has been invalidated');
    }
    
    const verification = verifyAccessToken(token);
    if (!verification.valid) {
      throw new ApiError(401, verification.error);
    }
    
    return verification.decoded;
  }
  
  async cleanupExpiredTokens() {
    const result = await RefreshToken.deleteMany({
      expiresAt: { $lt: new Date() }
    });
    
    logger.info(`Cleaned up ${result.deletedCount} expired tokens`);
    return result.deletedCount;
  }
}

module.exports = new TokenService();