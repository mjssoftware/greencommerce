const PaymentService = require('./payment.service');
const ChapaConfig = require('../config/chapa');
const TelebirrConfig = require('../config/tele birr');
const { publishEvent } = require('../config/rabbitmq');
const logger = require('../utils/logger');
const crypto = require('crypto');

class WebhookService {
  async handleChapaWebhook(payload, signature) {
    // Verify signature
    if (!ChapaConfig.verifyWebhookSignature(payload, signature)) {
      logger.error('Invalid Chapa webhook signature');
      throw new Error('Invalid signature');
    }
    
    const { tx_ref, status, reference } = payload;
    
    logger.info(`Processing Chapa webhook for transaction: ${tx_ref}, Status: ${status}`);
    
    if (status === 'success') {
      // Verify payment
      const verification = await ChapaConfig.verifyPayment(reference);
      
      if (verification.success && verification.status === 'completed') {
        const payment = await PaymentService.getPaymentByTransactionId(tx_ref);
        
        if (payment && payment.status !== 'completed') {
          await payment.markCompleted(verification.data);
          
          // Notify order service
          await publishEvent('payment.events', 'payment.success', {
            eventId: crypto.randomUUID(),
            eventType: 'payment.success',
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: 'payment-service',
            data: {
              transactionId: payment.transactionId,
              orderId: payment.orderId,
              orderNumber: payment.orderNumber,
              userId: payment.userId,
              amount: payment.amount,
              paymentMethod: payment.paymentMethod
            }
          });
        }
      }
    }
    
    return { received: true };
  }
  
  async handleTelebirrWebhook(payload) {
    // Verify signature
    if (!TelebirrConfig.verifyWebhook(payload)) {
      logger.error('Invalid Telebirr webhook signature');
      throw new Error('Invalid signature');
    }
    
    const { outTradeNo, tradeState, transactionId } = payload;
    
    logger.info(`Processing Telebirr webhook for transaction: ${outTradeNo}, Status: ${tradeState}`);
    
    if (tradeState === 'SUCCESS') {
      const payment = await PaymentService.getPaymentByTransactionId(outTradeNo);
      
      if (payment && payment.status !== 'completed') {
        const verification = await TelebirrConfig.verifyPayment(outTradeNo);
        
        if (verification.success && verification.status === 'completed') {
          await payment.markCompleted({
            transactionId,
            providerResponse: payload
          });
          
          // Notify order service
          await publishEvent('payment.events', 'payment.success', {
            eventId: crypto.randomUUID(),
            eventType: 'payment.success',
            version: '1.0',
            timestamp: new Date().toISOString(),
            source: 'payment-service',
            data: {
              transactionId: payment.transactionId,
              orderId: payment.orderId,
              orderNumber: payment.orderNumber,
              userId: payment.userId,
              amount: payment.amount,
              paymentMethod: payment.paymentMethod
            }
          });
        }
      }
    }
    
    return { received: true };
  }
}

module.exports = new WebhookService();