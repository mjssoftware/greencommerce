const User = require('../models/User.model');
const { Role } = require('../models/Role.model');
const { setCache, getCache, deleteCache } = require('../config/redis');
const { publishEvent } = require('../config/rabbitmq');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');

class UserService {
  async getAllUsers(query = {}) {
    const { page = 1, limit = 20, search, role, status } = query;
    
    const filter = {};
    if (search) {
      filter.$or = [
        { email: { $regex: search, $options: 'i' } },
        { firstName: { $regex: search, $options: 'i' } },
        { lastName: { $regex: search, $options: 'i' } }
      ];
    }
    if (role) filter.roles = role;
    if (status) filter.status = status;
    
    const users = await User.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .sort({ createdAt: -1 });
    
    const total = await User.countDocuments(filter);
    
    return {
      users,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  async getUserById(userId, cached = true) {
    // Check cache
    if (cached) {
      const cachedUser = await getCache(`user:${userId}`);
      if (cachedUser) return cachedUser;
    }
    
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Cache user data
    await setCache(`user:${userId}`, user.toJSON(), 3600);
    
    return user;
  }
  
  async updateUser(userId, updateData) {
    const { email, firstName, lastName, phoneNumber, preferences } = updateData;
    
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    // Check email uniqueness if changing
    if (email && email !== user.email) {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        throw new ApiError(409, 'Email already in use');
      }
      user.email = email;
      user.emailVerified = false; // Require re-verification
    }
    
    if (firstName) user.firstName = firstName;
    if (lastName) user.lastName = lastName;
    if (phoneNumber) user.phoneNumber = phoneNumber;
    if (preferences) user.preferences = { ...user.preferences, ...preferences };
    
    await user.save();
    
    // Clear cache
    await deleteCache(`user:${userId}`);
    
    // Publish user updated event
    await publishEvent('user.events', 'user.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'user.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email,
        updates: updateData
      }
    });
    
    return user;
  }
  
  async deleteUser(userId, hardDelete = false) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    if (hardDelete) {
      await user.deleteOne();
    } else {
      user.status = 'deleted';
      await user.save();
    }
    
    // Clear cache
    await deleteCache(`user:${userId}`);
    
    // Publish user deleted event
    await publishEvent('user.events', 'user.deleted', {
      eventId: crypto.randomUUID(),
      eventType: 'user.deleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email,
        hardDelete
      }
    });
    
    return true;
  }
  
  async updateUserRole(userId, roleName) {
    const user = await User.findById(userId);
    if (!user) {
      throw new ApiError(404, 'User not found');
    }
    
    const role = await Role.findOne({ name: roleName });
    if (!role) {
      throw new ApiError(404, 'Role not found');
    }
    
    user.roles = [roleName];
    user.permissions = role.permissions;
    await user.save();
    
    // Clear cache
    await deleteCache(`user:${userId}`);
    
    // Publish role updated event
    await publishEvent('user.events', 'user.role.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'user.role.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        role: roleName,
        permissions: role.permissions
      }
    });
    
    return user;
  }
  
  async getUserStats() {
    const totalUsers = await User.countDocuments();
    const activeUsers = await User.countDocuments({ status: 'active' });
    const verifiedUsers = await User.countDocuments({ emailVerified: true });
    const newUsersToday = await User.countDocuments({
      createdAt: { $gte: new Date().setHours(0, 0, 0, 0) }
    });
    
    const usersByRole = await User.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } }
    ]);
    
    return {
      total: totalUsers,
      active: activeUsers,
      verified: verifiedUsers,
      newToday: newUsersToday,
      byRole: usersByRole
    };
  }
  
  async searchUsers(searchTerm, limit = 10) {
    const users = await User.find({
      $or: [
        { email: { $regex: searchTerm, $options: 'i' } },
        { firstName: { $regex: searchTerm, $options: 'i' } },
        { lastName: { $regex: searchTerm, $options: 'i' } }
      ]
    })
    .limit(limit)
    .select('firstName lastName email avatar status');
    
    return users;
  }
}

module.exports = new UserService();