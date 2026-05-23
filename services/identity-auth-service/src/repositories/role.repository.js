const { Role } = require('../models/Role.model');

class RoleRepository {
  async create(roleData) {
    const role = new Role(roleData);
    return await role.save();
  }
  
  async findById(id) {
    return await Role.findById(id);
  }
  
  async findByName(name) {
    return await Role.findOne({ name });
  }
  
  async findAll() {
    return await Role.find().sort({ level: -1 });
  }
  
  async updateById(id, updateData) {
    return await Role.findByIdAndUpdate(
      id,
      updateData,
      { new: true, runValidators: true }
    );
  }
  
  async deleteById(id) {
    const role = await Role.findById(id);
    if (role.isDefault) {
      throw new Error('Cannot delete default role');
    }
    return await role.deleteOne();
  }
  
  async getDefaultRole() {
    return await Role.findOne({ isDefault: true });
  }
  
  async initializeDefaultRoles() {
    await Role.initializeDefaultRoles();
  }
}

module.exports = new RoleRepository();