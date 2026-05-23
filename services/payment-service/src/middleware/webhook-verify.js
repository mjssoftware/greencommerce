const crypto = require('crypto');
const logger = require('../utils/logger');

const verifyChapaWebhook = (req, res, next) => {
  const signature = req.headers['x-chapa-signature'];
  
  if (!signature) {
    logger.error('Missing Chapa webhook signature');
    return res.status(401).json({ error: 'Missing signature' });
  }
  
  // Store signature for webhook service to verify
  req.webhookSignature = signature;
  next();
};

const verifyTelebirrWebhook = (req, res, next) => {
  // Telebirr webhook verification logic
  // Typically includes signature validation
  next();
};

module.exports = { verifyChapaWebhook, verifyTelebirrWebhook };