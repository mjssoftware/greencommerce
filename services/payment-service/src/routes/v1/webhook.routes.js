const express = require('express');
const router = express.Router();
const webhookService = require('../services/webhook.service');
const { verifyChapaWebhook, verifyTelebirrWebhook } = require('../middleware/webhook-verify');
const logger = require('../utils/logger');

// Chapa webhook
router.post('/chapa', verifyChapaWebhook, async (req, res) => {
  try {
    await webhookService.handleChapaWebhook(req.body, req.webhookSignature);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    logger.error('Chapa webhook error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

// Telebirr webhook
router.post('/tele birr', verifyTelebirrWebhook, async (req, res) => {
  try {
    await webhookService.handleTelebirrWebhook(req.body);
    res.status(200).json({ status: 'success' });
  } catch (error) {
    logger.error('Telebirr webhook error:', error);
    res.status(500).json({ status: 'error', message: error.message });
  }
});

module.exports = router;