const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class ChapaConfig {
  constructor() {
    this.apiUrl = process.env.CHAPA_API_URL || 'https://api.chapa.co/v1';
    this.secretKey = process.env.CHAPA_SECRET_KEY;
    this.publicKey = process.env.CHAPA_PUBLIC_KEY;
    this.webhookSecret = process.env.CHAPA_WEBHOOK_SECRET;
    this.callbackUrl = process.env.CHAPA_CALLBACK_URL;
    
    this.client = axios.create({
      baseURL: this.apiUrl,
      headers: {
        'Authorization': `Bearer ${this.secretKey}`,
        'Content-Type': 'application/json'
      }
    });
  }
  
  async initializePayment(paymentData) {
    try {
      const payload = {
        amount: paymentData.amount,
        currency: paymentData.currency || 'ETB',
        email: paymentData.email,
        first_name: paymentData.firstName,
        last_name: paymentData.lastName,
        tx_ref: paymentData.transactionId,
        callback_url: this.callbackUrl,
        return_url: paymentData.returnUrl,
        customization: {
          title: 'E-commerce Payment',
          description: `Payment for order ${paymentData.orderNumber}`
        }
      };
      
      const response = await this.client.post('/transaction/initialize', payload);
      
      logger.info(`Chapa payment initialized: ${paymentData.transactionId}`);
      return {
        success: true,
        checkoutUrl: response.data.data.checkout_url,
        reference: response.data.data.reference
      };
    } catch (error) {
      logger.error('Chapa payment initialization failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Payment initialization failed'
      };
    }
  }
  
  async verifyPayment(reference) {
    try {
      const response = await this.client.get(`/transaction/verify/${reference}`);
      
      if (response.data.data.status === 'success') {
        logger.info(`Chapa payment verified: ${reference}`);
        return {
          success: true,
          status: 'completed',
          data: response.data.data
        };
      }
      
      return {
        success: false,
        status: 'pending',
        data: response.data.data
      };
    } catch (error) {
      logger.error('Chapa payment verification failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Verification failed'
      };
    }
  }
  
  verifyWebhookSignature(payload, signature) {
    const expectedSignature = crypto
      .createHmac('sha256', this.webhookSecret)
      .update(JSON.stringify(payload))
      .digest('hex');
    
    return signature === expectedSignature;
  }
  
  async refundPayment(transactionId, amount, reason) {
    try {
      const response = await this.client.post('/transaction/refund', {
        tx_ref: transactionId,
        amount: amount,
        reason: reason
      });
      
      logger.info(`Chapa refund processed: ${transactionId}`);
      return {
        success: true,
        refundId: response.data.data.refund_id
      };
    } catch (error) {
      logger.error('Chapa refund failed:', error.response?.data || error.message);
      return {
        success: false,
        error: error.response?.data?.message || 'Refund failed'
      };
    }
  }
}

module.exports = new ChapaConfig();