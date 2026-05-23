const UserService = require('../services/user.service');
const TokenService = require('../services/token.service');
const { ApiResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

class UserController {
  async getAllUsers(req, res, next) {
    try {
      const users = await UserService.getAllUsers(req.query);
      ApiResponse.success(res, users);
    } catch (error) {
      next(error);
    }
  }
  
  async getUserById(req, res, next) {
    try {
      const user = await UserService.getUserById(req.params.id);
      ApiResponse.success(res, { data: user });
    } catch (error) {
      next(error);
    }
  }
  
  async updateUser(req, res, next) {
    try {
      const user = await UserService.updateUser(req.params.id, req.body);
      ApiResponse.success(res, {
        message: 'User updated successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteUser(req, res, next) {
    try {
      const { hardDelete } = req.query;
      await UserService.deleteUser(req.params.id, hardDelete === 'true');
      ApiResponse.success(res, { message: 'User deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async updateUserRole(req, res, next) {
    try {
      const user = await UserService.updateUserRole(req.params.id, req.body.role);
      ApiResponse.success(res, {
        message: 'User role updated successfully',
        data: user
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getUserStats(req, res, next) {
    try {
      const stats = await UserService.getUserStats();
      ApiResponse.success(res, { data: stats });
    } catch (error) {
      next(error);
    }
  }
  
  async searchUsers(req, res, next) {
    try {
      const { q, limit } = req.query;
      const users = await UserService.searchUsers(q, parseInt(limit));
      ApiResponse.success(res, { data: users });
    } catch (error) {
      next(error);
    }
  }
  
  async getUserSessions(req, res, next) {
    try {
      const sessions = await TokenService.getUserActiveSessions(req.params.id);
      ApiResponse.success(res, { data: sessions });
    } catch (error) {
      next(error);
    }
  }
  
  async revokeUserSession(req, res, next) {
    try {
      await TokenService.revokeSpecificToken(req.params.tokenId, req.params.id);
      ApiResponse.success(res, { message: 'Session revoked successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async revokeAllSessions(req, res, next) {
    try {
      await TokenService.revokeAllUserTokens(req.params.id, 'user_request');
      ApiResponse.success(res, { message: 'All sessions revoked successfully' });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new UserController();