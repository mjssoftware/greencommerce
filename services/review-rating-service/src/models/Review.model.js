const mongoose = require('mongoose');
const Filter = require('bad-words');

const filter = new Filter();

const reviewSchema = new mongoose.Schema({
  productId: {
    type: String,
    required: true,
    index: true
  },
  userId: {
    type: String,
    required: true,
    index: true
  },
  orderId: {
    type: String,
    required: true,
    index: true
  },
  rating: {
    type: Number,
    required: true,
    min: 1,
    max: 5
  },
  title: {
    type: String,
    required: true,
    trim: true,
    maxlength: 200
  },
  content: {
    type: String,
    required: true,
    trim: true,
    minlength: 10,
    maxlength: 2000
  },
  images: [{
    url: String,
    caption: String,
    order: Number
  }],
  pros: [{
    type: String,
    trim: true
  }],
  cons: [{
    type: String,
    trim: true
  }],
  sentiment: {
    score: Number,
    label: {
      type: String,
      enum: ['positive', 'neutral', 'negative']
    },
    confidence: Number
  },
  verified: {
    type: Boolean,
    default: false
  },
  status: {
    type: String,
    enum: ['pending', 'approved', 'rejected', 'flagged'],
    default: 'pending'
  },
  helpfulVotes: {
    count: { type: Number, default: 0 },
    users: [String]
  },
  unhelpfulVotes: {
    count: { type: Number, default: 0 },
    users: [String]
  },
  replies: [{
    userId: { type: String, required: true },
    userName: String,
    content: { type: String, required: true },
    isSeller: { type: Boolean, default: false },
    createdAt: { type: Date, default: Date.now },
    updatedAt: Date
  }],
  flags: [{
    userId: String,
    reason: String,
    createdAt: { type: Date, default: Date.now }
  }],
  metadata: {
    ipAddress: String,
    userAgent: String,
    purchasedAt: Date,
    reviewedAt: Date
  },
  moderatedBy: String,
  moderatedAt: Date,
  moderationNotes: String
}, {
  timestamps: true,
  toJSON: { virtuals: true },
  toObject: { virtuals: true }
});

// Indexes
reviewSchema.index({ productId: 1, createdAt: -1 });
reviewSchema.index({ userId: 1, productId: 1 }, { unique: true });
reviewSchema.index({ rating: 1 });
reviewSchema.index({ status: 1, createdAt: -1 });
reviewSchema.index({ sentiment: 1 });

// Virtual for helpful percentage
reviewSchema.virtual('helpfulPercentage').get(function() {
  const total = this.helpfulVotes.count + this.unhelpfulVotes.count;
  if (total === 0) return 0;
  return (this.helpfulVotes.count / total) * 100;
});

// Method to add helpful vote
reviewSchema.methods.addHelpfulVote = async function(userId) {
  if (this.helpfulVotes.users.includes(userId)) {
    throw new Error('User already voted helpful');
  }
  
  if (this.unhelpfulVotes.users.includes(userId)) {
    this.unhelpfulVotes.users = this.unhelpfulVotes.users.filter(id => id !== userId);
    this.unhelpfulVotes.count--;
  }
  
  this.helpfulVotes.users.push(userId);
  this.helpfulVotes.count++;
  await this.save();
  
  return this;
};

// Method to add unhelpful vote
reviewSchema.methods.addUnhelpfulVote = async function(userId) {
  if (this.unhelpfulVotes.users.includes(userId)) {
    throw new Error('User already voted unhelpful');
  }
  
  if (this.helpfulVotes.users.includes(userId)) {
    this.helpfulVotes.users = this.helpfulVotes.users.filter(id => id !== userId);
    this.helpfulVotes.count--;
  }
  
  this.unhelpfulVotes.users.push(userId);
  this.unhelpfulVotes.count++;
  await this.save();
  
  return this;
};

// Method to add reply
reviewSchema.methods.addReply = async function(userId, userName, content, isSeller = false) {
  this.replies.push({
    userId,
    userName,
    content,
    isSeller,
    createdAt: new Date()
  });
  await this.save();
  
  return this;
};

// Method to flag review
reviewSchema.methods.flagReview = async function(userId, reason) {
  if (!this.flags.some(flag => flag.userId === userId)) {
    this.flags.push({ userId, reason });
    
    if (this.flags.length >= 3) {
      this.status = 'flagged';
    }
    
    await this.save();
  }
  
  return this;
};

// Pre-save middleware for content filtering
reviewSchema.pre('save', function(next) {
  if (this.isModified('content') && process.env.PROFANITY_FILTER_ENABLED === 'true') {
    this.content = filter.clean(this.content);
    if (this.title) this.title = filter.clean(this.title);
    if (this.pros) this.pros = this.pros.map(p => filter.clean(p));
    if (this.cons) this.cons = this.cons.map(c => filter.clean(c));
  }
  next();
});

const Review = mongoose.model('Review', reviewSchema);

module.exports = Review;