const express = require('express');
const router = express.Router();
const reviewController = require('../../controllers/review.controller');
const { authMiddleware, requirePermission } = require('../../middleware/auth');
const { validate, schemas } = require('../../middleware/validate');

// Public routes (limited info)
router.get('/products/:productId', reviewController.getReviewsByProduct);
router.get('/products/:productId/rating', reviewController.getProductRating);
router.get('/:reviewId', reviewController.getReviewById);

// Protected routes (require authentication)
router.use(authMiddleware);

// User routes
router.post('/', validate(schemas.createReview), reviewController.createReview);
router.put('/:reviewId', validate(schemas.updateReview), reviewController.updateReview);
router.delete('/:reviewId', reviewController.deleteReview);
router.post('/:reviewId/helpful', reviewController.addHelpfulVote);
router.post('/:reviewId/unhelpful', reviewController.addUnhelpfulVote);
router.post('/:reviewId/reply', validate(schemas.addReply), reviewController.addReply);
router.post('/:reviewId/flag', validate(schemas.flagReview), reviewController.flagReview);
router.get('/user/my-reviews', reviewController.getUserReviews);

// Admin/Moderator routes
router.get('/admin/pending', requirePermission('review:moderate'), reviewController.getReviewsForModeration);
router.put('/admin/:reviewId/moderate', requirePermission('review:moderate'), validate(schemas.moderateReview), reviewController.moderateReview);
router.get('/admin/stats', requirePermission('review:admin'), reviewController.getReviewStats);

module.exports = router;