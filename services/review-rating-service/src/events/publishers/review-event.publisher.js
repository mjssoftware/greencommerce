const { publishEvent } = require('../../config/rabbitmq');
const crypto = require('crypto');

let channel = null;

const initializeEventPublishers = (ch) => {
  channel = ch;
};

const publishReviewEvent = async (eventType, data) => {
  if (!channel) {
    console.error('RabbitMQ channel not initialized');
    return;
  }
  
  const event = {
    eventId: crypto.randomUUID(),
    eventType,
    version: '1.0',
    timestamp: new Date().toISOString(),
    source: 'review-service',
    data
  };
  
  await publishEvent('review.events', eventType, event);
};

const publishReviewCreated = (review) => {
  return publishReviewEvent('review.created', {
    reviewId: review._id,
    productId: review.productId,
    userId: review.userId,
    rating: review.rating,
    verified: review.verified
  });
};

const publishReviewUpdated = (review) => {
  return publishReviewEvent('review.updated', {
    reviewId: review._id,
    productId: review.productId,
    userId: review.userId,
    rating: review.rating
  });
};

const publishReviewDeleted = (reviewId, productId, userId) => {
  return publishReviewEvent('review.deleted', {
    reviewId,
    productId,
    userId
  });
};

const publishReviewModerated = (reviewId, productId, status, moderatorId) => {
  return publishReviewEvent('review.moderated', {
    reviewId,
    productId,
    status,
    moderatorId
  });
};

module.exports = {
  initializeEventPublishers,
  publishReviewCreated,
  publishReviewUpdated,
  publishReviewDeleted,
  publishReviewModerated
};