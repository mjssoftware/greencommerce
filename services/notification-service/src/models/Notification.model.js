const mongoose = require('mongoose');

const notificationSchema = new mongoose.Schema({
  userId: {
    type: String,
    required: true,
    index: true,
  },
  type: {
    type: String,
    enum: ['email', 'sms', 'push', 'in_app'],
    required: true,
  },
  channel: {
    type: String,
    enum: ['order', 'payment', 'inventory', 'user', 'promotion'],
    required: true,
  },
  title: {
    type: String,
    required: true,
  },
  content: {
    type: String,
    required: true,
  },
  data: {
    type: mongoose.Schema.Types.Mixed,
    default: {},
  },
  status: {
    type: String,
    enum: ['pending', 'sent', 'delivered', 'failed', 'read'],
    default: 'pending',
    index: true,
  },
  priority: {
    type: String,
    enum: ['low', 'medium', 'high', 'urgent'],
    default: 'medium',
  },
  scheduledFor: {
    type: Date,
    default: Date.now,
  },
  sentAt: Date,
  deliveredAt: Date,
  readAt: Date,
  failedReason: String,
  retryCount: {
    type: Number,
    default: 0,
  },
  metadata: {
    ipAddress: String,
    userAgent: String,
    deviceId: String,
  },
}, {
  timestamps: true,
});

// Indexes
notificationSchema.index({ userId: 1, createdAt: -1 });
notificationSchema.index({ status: 1, scheduledFor: 1 });
notificationSchema.index({ channel: 1, priority: 1 });

// Methods
notificationSchema.methods.markAsSent = function() {
  this.status = 'sent';
  this.sentAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsDelivered = function() {
  this.status = 'delivered';
  this.deliveredAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsRead = function() {
  this.status = 'read';
  this.readAt = new Date();
  return this.save();
};

notificationSchema.methods.markAsFailed = function(reason) {
  this.status = 'failed';
  this.failedReason = reason;
  this.retryCount += 1;
  return this.save();
};

const Notification = mongoose.model('Notification', notificationSchema);

module.exports = Notification;