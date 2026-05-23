const ReviewService = require('../services/review.service');
const { ApiResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

class ReviewController {
  async createReview(req, res, next) {
    try {
      const userId = req.user.id;
      const ipAddress = req.ip || req.connection.remoteAddress;
      const userAgent = req.headers['user-agent'];
      
      const review = await ReviewService.createReview(req.body, userId, ipAddress, userAgent);
      
      ApiResponse.success(res, {
        message: 'Review submitted successfully',
        data: review
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async getReviewsByProduct(req, res, next) {
    try {
      const { productId } = req.params;
      const result = await ReviewService.getReviewsByProduct(productId, req.query);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async getReviewById(req, res, next) {
    try {
      const { reviewId } = req.params;
      const review = await ReviewService.getReviewById(reviewId);
      ApiResponse.success(res, { data: review });
    } catch (error) {
      next(error);
    }
  }
  
  async updateReview(req, res, next) {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      
      const review = await ReviewService.updateReview(reviewId, userId, req.body);
      ApiResponse.success(res, {
        message: 'Review updated successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteReview(req, res, next) {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      const isAdmin = req.user.roles?.includes('admin');
      
      await ReviewService.deleteReview(reviewId, userId, isAdmin);
      ApiResponse.success(res, { message: 'Review deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async addHelpfulVote(req, res, next) {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      
      const review = await ReviewService.addHelpfulVote(reviewId, userId);
      ApiResponse.success(res, {
        message: 'Vote recorded successfully',
        data: { helpfulCount: review.helpfulVotes.count }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async addUnhelpfulVote(req, res, next) {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      
      const review = await ReviewService.addUnhelpfulVote(reviewId, userId);
      ApiResponse.success(res, {
        message: 'Vote recorded successfully',
        data: { unhelpfulCount: review.unhelpfulVotes.count }
      });
    } catch (error) {
      next(error);
    }
  }
  
  async addReply(req, res, next) {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      const { content } = req.body;
      const userName = req.user.name || 'Customer';
      const isSeller = req.user.roles?.includes('seller') || req.user.roles?.includes('admin');
      
      const review = await ReviewService.addReply(reviewId, userId, userName, content, isSeller);
      ApiResponse.success(res, {
        message: 'Reply added successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }
  
  async moderateReview(req, res, next) {
    try {
      const { reviewId } = req.params;
      const { status, notes } = req.body;
      const moderatorId = req.user.id;
      
      const review = await ReviewService.moderateReview(reviewId, status, moderatorId, notes);
      ApiResponse.success(res, {
        message: 'Review moderated successfully',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }
  
  async flagReview(req, res, next) {
    try {
      const userId = req.user.id;
      const { reviewId } = req.params;
      const { reason } = req.body;
      
      const review = await ReviewService.flagReview(reviewId, userId, reason);
      ApiResponse.success(res, {
        message: 'Review flagged for moderation',
        data: review
      });
    } catch (error) {
      next(error);
    }
  }
  
  async getProductRating(req, res, next) {
    try {
      const { productId } = req.params;
      const rating = await ReviewService.getProductRating(productId);
      ApiResponse.success(res, { data: rating });
    } catch (error) {
      next(error);
    }
  }
  
  async getUserReviews(req, res, next) {
    try {
      const userId = req.user.id;
      const result = await ReviewService.getUserReviews(userId, req.query);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async getReviewsForModeration(req, res, next) {
    try {
      const result = await ReviewService.getReviewsForModeration(req.query);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async getReviewStats(req, res, next) {
    try {
      const stats = await ReviewService.getReviewStats();
      ApiResponse.success(res, { data: stats });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ReviewController();