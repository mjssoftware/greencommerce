const { sendSms } = require('../config/sms');
const logger = require('../utils/logger');

class SmsService {
  async sendOrderConfirmation(phoneNumber, orderData) {
    const message = `Your order #${orderData.orderId} has been confirmed. Total: $${orderData.total}. We'll notify you when it ships.`;
    
    return await sendSms({
      to: phoneNumber,
      body: message,
    });
  }
  
  async sendOrderShipped(phoneNumber, orderData) {
    const message = `Great news! Your order #${orderData.orderId} has been shipped. Tracking #: ${orderData.trackingNumber}. Expected delivery: ${orderData.estimatedDelivery}`;
    
    return await sendSms({
      to: phoneNumber,
      body: message,
    });
  }
  
  async sendPaymentConfirmation(phoneNumber, paymentData) {
    const message = `Payment of $${paymentData.amount} for order #${paymentData.orderId} was successful. Transaction ID: ${paymentData.transactionId}`;
    
    return await sendSms({
      to: phoneNumber,
      body: message,
    });
  }
  
  async sendOTP(phoneNumber, otpCode) {
    const message = `Your verification code is: ${otpCode}. This code will expire in 10 minutes.`;
    
    return await sendSms({
      to: phoneNumber,
      body: message,
    });
  }
  
  async sendLowBalanceAlert(phoneNumber, walletData) {
    const message = `Your wallet balance is low: $${walletData.balance}. Please recharge to continue using our services.`;
    
    return await sendSms({
      to: phoneNumber,
      body: message,
    });
  }
}

module.exports = new SmsService();