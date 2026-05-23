const Review = require('../models/Review.model');
const Rating = require('../models/Rating.model');

class ReviewRepository {
  async create(reviewData) {
    const review = new Review(reviewData);
    return await review.save();
  }
  
  async findById(id) {
    return await Review.findById(id);
  }
  
  async findByProduct(productId, page = 1, limit = 20, filter = {}) {
    const query = { productId, ...filter };
    
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Review.countDocuments(query);
    
    return { reviews, total };
  }
  
  async findByUser(userId, page = 1, limit = 20, filter = {}) {
    const query = { userId, ...filter };
    
    const reviews = await Review.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Review.countDocuments(query);
    
    return { reviews, total };
  }
  
  async update(id, updateData) {
    return await Review.findByIdAndUpdate(id, updateData, { new: true });
  }
  
  async delete(id) {
    return await Review.findByIdAndDelete(id);
  }
  
  async getRating(productId) {
    return await Rating.findOne({ productId });
  }
  
  async updateRating(productId, ratingData) {
    return await Rating.findOneAndUpdate(
      { productId },
      ratingData,
      { new: true, upsert: true }
    );
  }
  
  async getProductStats(productId) {
    const stats = await Review.aggregate([
      { $match: { productId, status: 'approved' } },
      {
        $group: {
          _id: null,
          averageRating: { $avg: '$rating' },
          totalReviews: { $sum: 1 },
          ratingCounts: {
            $push: '$rating'
          }
        }
      }
    ]);
    
    return stats[0] || { averageRating: 0, totalReviews: 0 };
  }
  
  async getPendingReviews(page = 1, limit = 20) {
    return await this.findByStatus('pending', page, limit);
  }
  
  async findByStatus(status, page = 1, limit = 20) {
    const query = { status };
    
    const reviews = await Review.find(query)
      .sort({ createdAt: 1 })
      .skip((page - 1) * limit)
      .limit(limit);
    
    const total = await Review.countDocuments(query);
    
    return { reviews, total };
  }
}

module.exports = new ReviewRepository();