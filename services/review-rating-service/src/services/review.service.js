const Review = require('../models/Review.model');
const Rating = require('../models/Rating.model');
const SentimentService = require('./sentiment.service');
const { publishEvent } = require('../config/rabbitmq');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

class ReviewService {
  async createReview(reviewData, userId, ipAddress, userAgent) {
    // Check if user already reviewed this product
    const existingReview = await Review.findOne({
      productId: reviewData.productId,
      userId: userId
    });
    
    if (existingReview) {
      throw new ApiError(409, 'You have already reviewed this product');
    }
    
    // Verify user purchased the product
    const hasPurchased = await this.verifyPurchase(userId, reviewData.productId);
    
    // Perform sentiment analysis
    let sentiment = null;
    if (process.env.SENTIMENT_ANALYSIS_ENABLED === 'true') {
      sentiment = await SentimentService.analyzeSentiment(reviewData.content);
    }
    
    // Create review
    const review = new Review({
      ...reviewData,
      userId,
      verified: hasPurchased,
      sentiment,
      metadata: {
        ipAddress,
        userAgent,
        reviewedAt: new Date()
      }
    });
    
    await review.save();
    
    // Update product rating
    await this.updateProductRating(reviewData.productId);
    
    // Publish event
    await publishEvent('review.events', 'review.created', {
      eventId: crypto.randomUUID(),
      eventType: 'review.created',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'review-service',
      data: {
        reviewId: review._id,
        productId: review.productId,
        userId: review.userId,
        rating: review.rating,
        verified: review.verified,
        status: review.status
      }
    });
    
    // Send notification for moderation if needed
    if (review.status === 'pending' && process.env.REVIEW_MODERATION_ENABLED === 'true') {
      await this.notifyModeration(review);
    }
    
    return review;
  }
  
  async getReviewsByProduct(productId, query = {}) {
    const {
      page = 1,
      limit = 20,
      rating,
      sentiment,
      hasImages,
      hasPros,
      hasCons,
      verified,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      status = 'approved'
    } = query;
    
    const filter = { productId, status };
    
    if (rating) filter.rating = parseInt(rating);
    if (sentiment) filter['sentiment.label'] = sentiment;
    if (hasImages === 'true') filter['images.0'] = { $exists: true };
    if (hasPros === 'true') filter.pros = { $ne: [] };
    if (hasCons === 'true') filter.cons = { $ne: [] };
    if (verified === 'true') filter.verified = true;
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const reviews = await Review.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Review.countDocuments(filter);
    
    // Get rating summary
    const ratingSummary = await Rating.findOne({ productId });
    
    return {
      reviews,
      ratingSummary,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  async getReviewById(reviewId) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    return review;
  }
  
  async updateReview(reviewId, userId, updateData) {
    const review = await Review.findById(reviewId);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    if (review.userId !== userId) {
      throw new ApiError(403, 'You can only update your own reviews');
    }
    
    // Check if review can be updated (e.g., not too old)
    const daysSinceCreation = (Date.now() - review.createdAt) / (1000 * 60 * 60 * 24);
    if (daysSinceCreation > 30) {
      throw new ApiError(400, 'Reviews cannot be updated after 30 days');
    }
    
    // Update fields
    if (updateData.rating) review.rating = updateData.rating;
    if (updateData.title) review.title = updateData.title;
    if (updateData.content) {
      review.content = updateData.content;
      if (process.env.SENTIMENT_ANALYSIS_ENABLED === 'true') {
        review.sentiment = await SentimentService.analyzeSentiment(updateData.content);
      }
    }
    if (updateData.images) review.images = updateData.images;
    if (updateData.pros) review.pros = updateData.pros;
    if (updateData.cons) review.cons = updateData.cons;
    
    review.status = 'pending'; // Re-moderate updated review
    await review.save();
    
    // Update product rating
    await this.updateProductRating(review.productId);
    
    // Publish event
    await publishEvent('review.events', 'review.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'review.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'review-service',
      data: {
        reviewId: review._id,
        productId: review.productId,
        userId: review.userId
      }
    });
    
    return review;
  }
  
  async deleteReview(reviewId, userId, isAdmin = false) {
    const review = await Review.findById(reviewId);
    
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    if (!isAdmin && review.userId !== userId) {
      throw new ApiError(403, 'You can only delete your own reviews');
    }
    
    await review.deleteOne();
    
    // Update product rating
    await this.updateProductRating(review.productId);
    
    // Publish event
    await publishEvent('review.events', 'review.deleted', {
      eventId: crypto.randomUUID(),
      eventType: 'review.deleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'review-service',
      data: {
        reviewId: review._id,
        productId: review.productId,
        userId: review.userId
      }
    });
    
    return true;
  }
  
  async addHelpfulVote(reviewId, userId) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    await review.addHelpfulVote(userId);
    
    return review;
  }
  
  async addUnhelpfulVote(reviewId, userId) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    await review.addUnhelpfulVote(userId);
    
    return review;
  }
  
  async addReply(reviewId, userId, userName, content, isSeller = false) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    await review.addReply(userId, userName, content, isSeller);
    
    // Publish event
    await publishEvent('review.events', 'review.reply.added', {
      eventId: crypto.randomUUID(),
      eventType: 'review.reply.added',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'review-service',
      data: {
        reviewId: review._id,
        productId: review.productId,
        userId,
        isSeller
      }
    });
    
    return review;
  }
  
  async moderateReview(reviewId, status, moderatorId, notes) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    review.status = status;
    review.moderatedBy = moderatorId;
    review.moderatedAt = new Date();
    review.moderationNotes = notes;
    await review.save();
    
    // Update product rating if approved or rejected
    if (status === 'approved') {
      await this.updateProductRating(review.productId);
      
      // Notify user that review is approved
      await this.notifyReviewApproved(review);
    } else if (status === 'rejected') {
      await this.notifyReviewRejected(review, notes);
    }
    
    // Publish event
    await publishEvent('review.events', 'review.moderated', {
      eventId: crypto.randomUUID(),
      eventType: 'review.moderated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'review-service',
      data: {
        reviewId: review._id,
        productId: review.productId,
        status,
        moderatorId
      }
    });
    
    return review;
  }
  
  async flagReview(reviewId, userId, reason) {
    const review = await Review.findById(reviewId);
    if (!review) {
      throw new ApiError(404, 'Review not found');
    }
    
    await review.flagReview(userId, reason);
    
    // Notify admin if review gets flagged multiple times
    if (review.flags.length >= 3) {
      await this.notifyFlaggedReview(review);
    }
    
    return review;
  }
  
  async updateProductRating(productId) {
    const reviews = await Review.find({ 
      productId, 
      status: 'approved' 
    });
    
    const rating = await Rating.getOrCreate(productId);
    await rating.updateFromReviews(reviews);
    
    // Update product service with new rating
    if (process.env.UPDATE_PRODUCT_RATING === 'true') {
      await this.updateProductServiceRating(productId, rating.averageRating, rating.totalReviews);
    }
    
    return rating;
  }
  
  async getProductRating(productId) {
    const rating = await Rating.findOne({ productId });
    return rating || { averageRating: 0, totalReviews: 0 };
  }
  
  async getUserReviews(userId, query = {}) {
    const { page = 1, limit = 20, status, sortBy = 'createdAt', sortOrder = 'desc' } = query;
    
    const filter = { userId };
    if (status) filter.status = status;
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const reviews = await Review.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Review.countDocuments(filter);
    
    return {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  async getReviewsForModeration(query = {}) {
    const { page = 1, limit = 20, status = 'pending', sortBy = 'createdAt', sortOrder = 'desc' } = query;
    
    const filter = { status };
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const reviews = await Review.find(filter)
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Review.countDocuments(filter);
    
    return {
      reviews,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
  
  async getReviewStats() {
    const totalReviews = await Review.countDocuments();
    const approvedReviews = await Review.countDocuments({ status: 'approved' });
    const pendingReviews = await Review.countDocuments({ status: 'pending' });
    const flaggedReviews = await Review.countDocuments({ status: 'flagged' });
    const rejectedReviews = await Review.countDocuments({ status: 'rejected' });
    
    const averageRating = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: null, avg: { $avg: '$rating' } } }
    ]);
    
    const ratingDistribution = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$rating', count: { $sum: 1 } } },
      { $sort: { _id: 1 } }
    ]);
    
    const sentimentDistribution = await Review.aggregate([
      { $match: { status: 'approved', 'sentiment.label': { $exists: true } } },
      { $group: { _id: '$sentiment.label', count: { $sum: 1 } } }
    ]);
    
    const verifiedPercentage = await Review.aggregate([
      { $match: { status: 'approved' } },
      { $group: { _id: '$verified', count: { $sum: 1 } } }
    ]);
    
    return {
      total: totalReviews,
      approved: approvedReviews,
      pending: pendingReviews,
      flagged: flaggedReviews,
      rejected: rejectedReviews,
      averageRating: averageRating[0]?.avg || 0,
      ratingDistribution,
      sentimentDistribution,
      verifiedPercentage: (verifiedPercentage.find(v => v._id === true)?.count / approvedReviews * 100) || 0
    };
  }
  
  async verifyPurchase(userId, productId) {
    try {
      const response = await axios.get(`${process.env.ORDER_SERVICE_URL}/api/v1/orders/my-orders`, {
        headers: { 'X-User-Id': userId }
      });
      
      const orders = response.data.data.orders || [];
      const hasPurchased = orders.some(order => 
        order.status === 'delivered' && 
        order.items.some(item => item.productId === productId)
      );
      
      return hasPurchased;
    } catch (error) {
      logger.error('Failed to verify purchase:', error.message);
      return false;
    }
  }
  
  async updateProductServiceRating(productId, averageRating, totalReviews) {
    try {
      await axios.patch(`${process.env.PRODUCT_SERVICE_URL}/api/v1/products/${productId}/rating`, {
        averageRating,
        totalReviews
      });
    } catch (error) {
      logger.error('Failed to update product rating:', error.message);
    }
  }
  
  async notifyModeration(review) {
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/v1/notifications`, {
        userId: 'admin',
        type: 'email',
        channel: 'moderation',
        title: 'New Review Pending Moderation',
        content: `A new review for product ${review.productId} requires moderation.`,
        data: { reviewId: review._id }
      });
    } catch (error) {
      logger.error('Failed to send moderation notification:', error.message);
    }
  }
  
  async notifyReviewApproved(review) {
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/v1/notifications`, {
        userId: review.userId,
        type: 'email',
        channel: 'review',
        title: 'Your Review Has Been Approved',
        content: `Your review for product has been approved and is now visible.`,
        data: { reviewId: review._id }
      });
    } catch (error) {
      logger.error('Failed to send approval notification:', error.message);
    }
  }
  
  async notifyReviewRejected(review, reason) {
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/v1/notifications`, {
        userId: review.userId,
        type: 'email',
        channel: 'review',
        title: 'Your Review Was Not Approved',
        content: `Your review was not approved. Reason: ${reason}`,
        data: { reviewId: review._id }
      });
    } catch (error) {
      logger.error('Failed to send rejection notification:', error.message);
    }
  }
  
  async notifyFlaggedReview(review) {
    try {
      await axios.post(`${process.env.NOTIFICATION_SERVICE_URL}/api/v1/notifications`, {
        userId: 'admin',
        type: 'email',
        channel: 'moderation',
        title: 'Review Flagged Multiple Times',
        content: `A review has been flagged ${review.flags.length} times and requires attention.`,
        data: { reviewId: review._id }
      });
    } catch (error) {
      logger.error('Failed to send flagged notification:', error.message);
    }
  }
}

module.exports = new ReviewService();