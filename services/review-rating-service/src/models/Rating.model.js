const mongoose = require('mongoose');

const ratingSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    unique: true,
    index: true
  },
  averageRating: {
    type: Number,
    default: 0,
    min: 0,
    max: 5
  },
  totalReviews: {
    type: Number,
    default: 0
  },
  ratingDistribution: {
    1: { type: Number, default: 0 },
    2: { type: Number, default: 0 },
    3: { type: Number, default: 0 },
    4: { type: Number, default: 0 },
    5: { type: Number, default: 0 }
  },
  sentimentBreakdown: {
    positive: { type: Number, default: 0 },
    neutral: { type: Number, default: 0 },
    negative: { type: Number, default: 0 }
  },
  verifiedReviews: {
    type: Number,
    default: 0
  },
  withImages: {
    type: Number,
    default: 0
  },
  withPros: {
    type: Number,
    default: 0
  },
  withCons: {
    type: Number,
    default: 0
  },
  lastUpdated: {
    type: Date,
    default: Date.now
  }
}, {
  timestamps: true
});

// Method to update rating from reviews
ratingSchema.methods.updateFromReviews = async function(reviews) {
  const total = reviews.length;
  
  if (total === 0) {
    this.averageRating = 0;
    this.totalReviews = 0;
    this.ratingDistribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    this.sentimentBreakdown = { positive: 0, neutral: 0, negative: 0 };
    this.verifiedReviews = 0;
    this.withImages = 0;
    this.withPros = 0;
    this.withCons = 0;
  } else {
    let sum = 0;
    const distribution = { 1: 0, 2: 0, 3: 0, 4: 0, 5: 0 };
    const sentimentCount = { positive: 0, neutral: 0, negative: 0 };
    let verifiedCount = 0;
    let imagesCount = 0;
    let prosCount = 0;
    let consCount = 0;
    
    for (const review of reviews) {
      sum += review.rating;
      distribution[review.rating]++;
      
      if (review.sentiment?.label) {
        sentimentCount[review.sentiment.label]++;
      }
      
      if (review.verified) verifiedCount++;
      if (review.images?.length > 0) imagesCount++;
      if (review.pros?.length > 0) prosCount++;
      if (review.cons?.length > 0) consCount++;
    }
    
    this.averageRating = parseFloat((sum / total).toFixed(process.env.RATING_AVERAGE_DECIMALS || 2));
    this.totalReviews = total;
    this.ratingDistribution = distribution;
    this.sentimentBreakdown = sentimentCount;
    this.verifiedReviews = verifiedCount;
    this.withImages = imagesCount;
    this.withPros = prosCount;
    this.withCons = consCount;
  }
  
  this.lastUpdated = new Date();
  await this.save();
  
  return this;
};

// Static method to get or create rating for product
ratingSchema.statics.getOrCreate = async function(productId) {
  let rating = await this.findOne({ productId });
  
  if (!rating) {
    rating = new this({ productId });
    await rating.save();
  }
  
  return rating;
};

const Rating = mongoose.model('Rating', ratingSchema);

module.exports = Rating;