const axios = require('axios');
const crypto = require('crypto');
const logger = require('../utils/logger');

class TelebirrConfig {
  constructor() {
    this.appId = process.env.TELEBIRR_APP_ID;
    this.appKey = process.env.TELEBIRR_APP_KEY;
    this.shortCode = process.env.TELEBIRR_SHORT_CODE;
    this.apiUrl = process.env.TELEBIRR_API_URL;
    this.callbackUrl = process.env.TELEBIRR_CALLBACK_URL;
  }
  
  generateSignature(data) {
    const stringToSign = `${this.appId}${data.outTradeNo}${data.totalAmount}${this.appKey}`;
    return crypto.createHash('md5').update(stringToSign).digest('hex');
  }
  
  async initializePayment(paymentData) {
    try {
      const payload = {
        appId: this.appId,
        appKey: this.appKey,
        shortCode: this.shortCode,
        outTradeNo: paymentData.transactionId,
        subject: `Order ${paymentData.orderNumber}`,
        totalAmount: paymentData.amount,
        timeoutExpress: '30m',
        returnUrl: paymentData.returnUrl,
        notifyUrl: this.callbackUrl,
        signType: 'MD5'
      };
      
      payload.sign = this.generateSignature(payload);
      
      const response = await axios.post(`${this.apiUrl}/unifiedOrder`, payload);
      
      if (response.data.code === '10000') {
        logger.info(`Telebirr payment initialized: ${paymentData.transactionId}`);
        return {
          success: true,
          paymentUrl: response.data.payInfo,
          orderId: response.data.orderId
        };
      }
      
      return {
        success: false,
        error: response.data.msg
      };
    } catch (error) {
      logger.error('Telebirr payment initialization failed:', error.message);
      return {
        success: false,
        error: 'Payment initialization failed'
      };
    }
  }
  
  async verifyPayment(transactionId) {
    try {
      const payload = {
        appId: this.appId,
        appKey: this.appKey,
        outTradeNo: transactionId
      };
      
      payload.sign = this.generateSignature(payload);
      
      const response = await axios.post(`${this.apiUrl}/orderQuery`, payload);
      
      if (response.data.code === '10000') {
        const status = response.data.tradeState === 'SUCCESS' ? 'completed' : 'pending';
        
        logger.info(`Telebirr payment verified: ${transactionId}, Status: ${status}`);
        return {
          success: true,
          status,
          data: response.data
        };
      }
      
      return {
        success: false,
        error: response.data.msg
      };
    } catch (error) {
      logger.error('Telebirr payment verification failed:', error.message);
      return {
        success: false,
        error: 'Verification failed'
      };
    }
  }
  
  async refundPayment(transactionId, amount, reason) {
    try {
      const payload = {
        appId: this.appId,
        appKey: this.appKey,
        outTradeNo: transactionId,
        refundAmount: amount,
        refundReason: reason
      };
      
      payload.sign = this.generateSignature(payload);
      
      const response = await axios.post(`${this.apiUrl}/refund`, payload);
      
      if (response.data.code === '10000') {
        logger.info(`Telebirr refund processed: ${transactionId}`);
        return {
          success: true,
          refundId: response.data.refundId
        };
      }
      
      return {
        success: false,
        error: response.data.msg
      };
    } catch (error) {
      logger.error('Telebirr refund failed:', error.message);
      return {
        success: false,
        error: 'Refund failed'
      };
    }
  }
  
  verifyWebhook(payload) {
    const receivedSign = payload.sign;
    const expectedSign = this.generateSignature(payload);
    return receivedSign === expectedSign;
  }
}

module.exports = new TelebirrConfig();