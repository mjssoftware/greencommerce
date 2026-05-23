const AuthService = require('../services/auth.service');
const { ApiResponse } = require('../utils/api-response');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');

class AuthController {
  async register(req, res, next) {
    try {
      const { email, password, firstName, lastName, phoneNumber } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      const result = await AuthService.register(
        { email, password, firstName, lastName, phoneNumber },
        ipAddress,
        userAgent
      );
      
      ApiResponse.success(res, {
        message: 'Registration successful. Please verify your email.',
        data: result
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async login(req, res, next) {
    try {
      const { email, password } = req.body;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      const result = await AuthService.login(email, password, ipAddress, userAgent);
      
      // Set refresh token in HTTP-only cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
      });
      
      ApiResponse.success(res, {
        message: 'Login successful',
        data: {
          user: result.user,
          accessToken: result.accessToken
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async logout(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      const accessToken = req.headers.authorization?.split(' ')[1];
      const userId = req.user.id;
      
      await AuthService.logout(refreshToken, accessToken, userId);
      
      // Clear refresh token cookie
      res.clearCookie('refreshToken');
      
      ApiResponse.success(res, { message: 'Logout successful' });
    } catch (error) {
      next(error);
    }
  }
  
  async refreshToken(req, res, next) {
    try {
      const refreshToken = req.cookies.refreshToken || req.body.refreshToken;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      if (!refreshToken) {
        throw new ApiError(401, 'Refresh token required');
      }
      
      const result = await AuthService.refreshToken(refreshToken, ipAddress, userAgent);
      
      // Set new refresh token in cookie
      res.cookie('refreshToken', result.refreshToken, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'strict',
        maxAge: 7 * 24 * 60 * 60 * 1000
      });
      
      ApiResponse.success(res, {
        data: {
          accessToken: result.accessToken,
          user: result.user
        }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async verifyEmail(req, res, next) {
    try {
      const { token } = req.query;
      
      if (!token) {
        throw new ApiError(400, 'Verification token required');
      }
      
      await AuthService.verifyEmail(token);
      
      ApiResponse.success(res, { message: 'Email verified successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async forgotPassword(req, res, next) {
    try {
      const { email } = req.body;
      
      await AuthService.forgotPassword(email);
      
      ApiResponse.success(res, {
        message: 'If an account exists with that email, you will receive a password reset link'
      });
    } catch (error) {
      next(error);
    }
  }
  
  async resetPassword(req, res, next) {
    try {
      const { token, newPassword } = req.body;
      
      await AuthService.resetPassword(token, newPassword);
      
      ApiResponse.success(res, { message: 'Password reset successful' });
    } catch (error) {
      next(error);
    }
  }
  
  async changePassword(req, res, next) {
    try {
      const userId = req.user.id;
      const { oldPassword, newPassword } = req.body;
      
      await AuthService.changePassword(userId, oldPassword, newPassword);
      
      ApiResponse.success(res, { message: 'Password changed successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async getMe(req, res, next) {
    try {
      const user = await UserService.getUserById(req.user.id);
      
      ApiResponse.success(res, { data: user });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new AuthController();