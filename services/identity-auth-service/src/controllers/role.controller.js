const { Role } = require('../models/Role.model');
const { ApiResponse } = require('../utils/api-response');
const { ApiError } = require('../utils/api-error');

class RoleController {
  async getAllRoles(req, res, next) {
    try {
      const roles = await Role.find().sort({ level: -1 });
      ApiResponse.success(res, { data: roles });
    } catch (error) {
      next(error);
    }
  }
  
  async getRoleById(req, res, next) {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) {
        throw new ApiError(404, 'Role not found');
      }
      ApiResponse.success(res, { data: role });
    } catch (error) {
      next(error);
    }
  }
  
  async createRole(req, res, next) {
    try {
      const { name, description, permissions, level } = req.body;
      
      const existingRole = await Role.findOne({ name });
      if (existingRole) {
        throw new ApiError(409, 'Role already exists');
      }
      
      const role = new Role({ name, description, permissions, level });
      await role.save();
      
      ApiResponse.success(res, {
        message: 'Role created successfully',
        data: role
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async updateRole(req, res, next) {
    try {
      const role = await Role.findByIdAndUpdate(
        req.params.id,
        req.body,
        { new: true, runValidators: true }
      );
      
      if (!role) {
        throw new ApiError(404, 'Role not found');
      }
      
      ApiResponse.success(res, {
        message: 'Role updated successfully',
        data: role
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteRole(req, res, next) {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) {
        throw new ApiError(404, 'Role not found');
      }
      
      if (role.isDefault) {
        throw new ApiError(400, 'Cannot delete default role');
      }
      
      await role.deleteOne();
      ApiResponse.success(res, { message: 'Role deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async getRolePermissions(req, res, next) {
    try {
      const role = await Role.findById(req.params.id);
      if (!role) {
        throw new ApiError(404, 'Role not found');
      }
      
      ApiResponse.success(res, { data: role.permissions });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new RoleController();