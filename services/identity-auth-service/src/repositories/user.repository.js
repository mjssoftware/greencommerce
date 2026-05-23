const User = require('../models/User.model');

class UserRepository {
  async create(userData) {
    const user = new User(userData);
    return await user.save();
  }
  
  async findById(id, includePassword = false) {
    let query = User.findById(id);
    if (includePassword) query = query.select('+password');
    return await query;
  }
  
  async findByEmail(email, includePassword = false) {
    let query = User.findOne({ email });
    if (includePassword) query = query.select('+password');
    return await query;
  }
  
  async findAll(filter = {}, options = {}) {
    const { page = 1, limit = 20, sortBy = 'createdAt', sortOrder = 'desc' } = options;
    
    const users = await User.find(filter)
      .sort({ [sortBy]: sortOrder })
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await User.countDocuments(filter);
    
    return { users, total };
  }
  
  async updateById(id, updateData) {
    return await User.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  }
  
  async deleteById(id, hardDelete = false) {
    if (hardDelete) {
      return await User.findByIdAndDelete(id);
    } else {
      return await User.findByIdAndUpdate(
        id,
        { status: 'deleted' },
        { new: true }
      );
    }
  }
  
  async updateLoginInfo(id, ipAddress) {
    return await User.findByIdAndUpdate(
      id,
      {
        lastLogin: new Date(),
        lastLoginIP: ipAddress,
        loginAttempts: 0,
        lockUntil: null
      },
      { new: true }
    );
  }
  
  async incrementLoginAttempts(id) {
    const MAX_ATTEMPTS = parseInt(process.env.MAX_LOGIN_ATTEMPTS) || 5;
    const LOCK_TIME = parseInt(process.env.LOCKOUT_DURATION_MINUTES) || 30;
    
    const user = await User.findById(id);
    if (!user) return null;
    
    user.loginAttempts += 1;
    
    if (user.loginAttempts >= MAX_ATTEMPTS) {
      user.lockUntil = new Date(Date.now() + LOCK_TIME * 60 * 1000);
    }
    
    await user.save();
    return user;
  }
  
  async findUsersByRole(role) {
    return await User.find({ roles: role });
  }
  
  async getStatistics() {
    const total = await User.countDocuments();
    const active = await User.countDocuments({ status: 'active' });
    const verified = await User.countDocuments({ emailVerified: true });
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const newToday = await User.countDocuments({ createdAt: { $gte: today } });
    
    const byRole = await User.aggregate([
      { $unwind: '$roles' },
      { $group: { _id: '$roles', count: { $sum: 1 } } }
    ]);
    
    return { total, active, verified, newToday, byRole };
  }
}

module.exports = new UserRepository();