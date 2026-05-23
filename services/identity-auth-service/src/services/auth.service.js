const User = require('../models/User.model');
const RefreshToken = require('../models/RefreshToken.model');
const { generateTokens, verifyRefreshToken } = require('../config/jwt');
const { publishEvent } = require('../config/rabbitmq');
const { setCache, deleteCache, blacklistToken } = require('../config/redis');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');
const moment = require('moment');

class AuthService {
  async register(userData, ipAddress, userAgent) {
    const { email, password, firstName, lastName, phoneNumber } = userData;
    
    // Check if user exists
    const existingUser = await User.findOne({ email });
    if (existingUser) {
      throw new ApiError(409, 'User already exists');
    }
    
    // Create user
    const user = new User({
      email,
      password,
      firstName,
      lastName,
      phoneNumber,
      metadata: {
        registeredIP: ipAddress,
        userAgent
      }
    });
    
    await user.save();
    
    // Generate email verification token
    const verificationToken = crypto.randomBytes(32).toString('hex');
    user.emailVerificationToken = verificationToken;
    user.emailVerificationExpires = new Date(Date.now() + 24 * 60 * 60 * 1000);
    await user.save();
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      user._id,
      user.email,
      user.roles,
      user.permissions
    );
    
    // Save refresh token
    const refreshTokenDoc = new RefreshToken({
      token: refreshToken,
      userId: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent,
      ipAddress
    });
    await refreshTokenDoc.save();
    
    // Publish user created event
    await publishEvent('user.events', 'user.created', {
      eventId: crypto.randomUUID(),
      eventType: 'user.created',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email,
        name: user.firstName,
        phoneNumber: user.phoneNumber
      }
    });
    
    // Cache user data
    await setCache(`user:${user._id}`, {
      id: user._id,
      email: user.email,
      name: user.firstName,
      roles: user.roles
    }, 3600);
    
    return {
      user: user.toJSON(),
      accessToken,
      refreshToken,
      requiresEmailVerification: true
    };
  }
  
  async login(email, password, ipAddress, userAgent) {
    // Find user with password field
    const user = await User.findOne({ email }).select('+password');
    
    if (!user) {
      throw new ApiError(401, 'Invalid credentials');
    }
    
    // Check if account is locked
    if (user.isLocked()) {
      const lockUntil = moment(user.lockUntil).fromNow();
      throw new ApiError(401, `Account is locked. Try again ${lockUntil}`);
    }
    
    // Check status
    if (user.status !== 'active') {
      throw new ApiError(401, `Account is ${user.status}`);
    }
    
    // Verify password
    const isPasswordValid = await user.comparePassword(password);
    if (!isPasswordValid) {
      await user.incLoginAttempts();
      throw new ApiError(401, 'Invalid credentials');
    }
    
    // Reset login attempts on successful login
    await user.resetLoginAttempts();
    
    // Update last login
    user.lastLogin = new Date();
    user.lastLoginIP = ipAddress;
    await user.save();
    
    // Generate tokens
    const { accessToken, refreshToken } = generateTokens(
      user._id,
      user.email,
      user.roles,
      user.permissions
    );
    
    // Save refresh token
    const refreshTokenDoc = new RefreshToken({
      token: refreshToken,
      userId: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent,
      ipAddress
    });
    await refreshTokenDoc.save();
    
    // Publish user login event
    await publishEvent('user.events', 'user.login', {
      eventId: crypto.randomUUID(),
      eventType: 'user.login',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email,
        ipAddress,
        userAgent
      }
    });
    
    return {
      user: user.toJSON(),
      accessToken,
      refreshToken
    };
  }
  
  async logout(refreshToken, accessToken, userId) {
    // Revoke refresh token
    await RefreshToken.findOneAndUpdate(
      { token: refreshToken, userId },
      { revoked: true, revokedAt: new Date(), revokedReason: 'logout' }
    );
    
    // Blacklist access token
    const decoded = verifyRefreshToken(refreshToken);
    if (decoded.valid && decoded.decoded.exp) {
      const ttl = decoded.decoded.exp - Math.floor(Date.now() / 1000);
      if (ttl > 0) {
        await blacklistToken(accessToken, ttl);
      }
    }
    
    // Clear user cache
    await deleteCache(`user:${userId}`);
    
    // Publish logout event
    await publishEvent('user.events', 'user.logout', {
      eventId: crypto.randomUUID(),
      eventType: 'user.logout',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: { userId }
    });
    
    return true;
  }
  
  async refreshToken(refreshToken, ipAddress, userAgent) {
    // Verify refresh token
    const verification = verifyRefreshToken(refreshToken);
    if (!verification.valid) {
      throw new ApiError(401, 'Invalid refresh token');
    }
    
    const { sub: userId } = verification.decoded;
    
    // Check if token exists and is not revoked
    const tokenDoc = await RefreshToken.findOne({
      token: refreshToken,
      userId,
      revoked: false
    });
    
    if (!tokenDoc) {
      throw new ApiError(401, 'Refresh token not found or revoked');
    }
    
    // Check if token is expired
    if (tokenDoc.expiresAt < new Date()) {
      throw new ApiError(401, 'Refresh token expired');
    }
    
    // Get user
    const user = await User.findById(userId);
    if (!user || user.status !== 'active') {
      throw new ApiError(401, 'User not found or inactive');
    }
    
    // Revoke old token
    await tokenDoc.updateOne({
      revoked: true,
      revokedAt: new Date(),
      revokedReason: 'refresh'
    });
    
    // Generate new tokens
    const { accessToken, refreshToken: newRefreshToken } = generateTokens(
      user._id,
      user.email,
      user.roles,
      user.permissions
    );
    
    // Save new refresh token
    const newTokenDoc = new RefreshToken({
      token: newRefreshToken,
      userId: user._id,
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      userAgent,
      ipAddress
    });
    await newTokenDoc.save();
    
    return {
      accessToken,
      refreshToken: newRefreshToken,
      user: user.toJSON()
    };
  }
  
  async verifyEmail(token) {
    const user = await User.findOne({
      emailVerificationToken: token,
      emailVerificationExpires: { $gt: new Date() }
    });
    
    if (!user) {
      throw new ApiError(400, 'Invalid or expired verification token');
    }
    
    user.emailVerified = true;
    user.emailVerificationToken = undefined;
    user.emailVerificationExpires = undefined;
    await user.save();
    
    // Publish email verified event
    await publishEvent('user.events', 'user.email.verified', {
      eventId: crypto.randomUUID(),
      eventType: 'user.email.verified',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email
      }
    });
    
    return true;
  }
  
  async forgotPassword(email) {
    const user = await User.findOne({ email });
    if (!user) {
      // Don't reveal if user exists
      return true;
    }
    
    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    user.passwordResetToken = resetToken;
    user.passwordResetExpires = new Date(Date.now() + 1 * 60 * 60 * 1000);
    await user.save();
    
    // Publish password reset event
    await publishEvent('user.events', 'user.password.reset.requested', {
      eventId: crypto.randomUUID(),
      eventType: 'user.password.reset.requested',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email,
        resetToken,
        name: user.firstName
      }
    });
    
    return true;
  }
  
  async resetPassword(token, newPassword) {
    const user = await User.findOne({
      passwordResetToken: token,
      passwordResetExpires: { $gt: new Date() }
    });
    
    if (!user) {
      throw new ApiError(400, 'Invalid or expired reset token');
    }
    
    user.password = newPassword;
    user.passwordResetToken = undefined;
    user.passwordResetExpires = undefined;
    await user.save();
    
    // Revoke all refresh tokens
    await RefreshToken.updateMany(
      { userId: user._id, revoked: false },
      { revoked: true, revokedAt: new Date(), revokedReason: 'password_change' }
    );
    
    // Publish password changed event
    await publishEvent('user.events', 'user.password.changed', {
      eventId: crypto.randomUUID(),
      eventType: 'user.password.changed',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: { userId: user._id, email: user.email }
    });
    
    return true;
  }
  
  async changePassword(userId, oldPassword, newPassword) {
    const user = await User.findById(userId).select('+password');
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    const isPasswordValid = await user.comparePassword(oldPassword);
    if (!isPasswordValid) {
      throw new ApiError(401, 'Current password is incorrect');
    }
    
    user.password = newPassword;
    await user.save();
    
    // Revoke all refresh tokens except current session
    await RefreshToken.updateMany(
      { userId, revoked: false },
      { revoked: true, revokedAt: new Date(), revokedReason: 'password_change' }
    );
    
    return true;
  }
}

module.exports = new AuthService();