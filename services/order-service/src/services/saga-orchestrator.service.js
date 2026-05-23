const { publishEvent } = require('../config/rabbitmq');
const { getCache, setCache } = require('../config/redis');
const logger = require('../utils/logger');
const crypto = require('crypto');
const axios = require('axios');

class SagaOrchestrator {
  constructor() {
    this.sagaTimeout = parseInt(process.env.SAGA_TIMEOUT_MS) || 30000;
    this.compensationRetryCount = parseInt(process.env.SAGA_COMPENSATION_RETRY_COUNT) || 3;
    this.compensationRetryDelay = parseInt(process.env.SAGA_COMPENSATION_RETRY_DELAY_MS) || 5000;
  }
  
  async executeOrderSaga(order) {
    const sagaId = crypto.randomUUID();
    const sagaContext = {
      sagaId,
      orderId: order._id,
      orderNumber: order.orderNumber,
      userId: order.userId,
      items: order.items,
      total: order.summary.total,
      step: 'init',
      compensationSteps: []
    };
    
    try {
      // Step 1: Reserve Inventory
      logger.info(`Saga ${sagaId}: Starting inventory reservation`);
      await this.reserveInventory(sagaContext);
      
      // Step 2: Process Payment
      logger.info(`Saga ${sagaId}: Starting payment processing`);
      await this.processPayment(sagaContext);
      
      // Step 3: Confirm Order
      logger.info(`Saga ${sagaId}: Confirming order`);
      await this.confirmOrder(sagaContext);
      
      // Step 4: Send Notifications
      logger.info(`Saga ${sagaId}: Sending notifications`);
      await this.sendNotifications(sagaContext);
      
      // Update saga context
      sagaContext.step = 'complete';
      await this.updateSagaContext(sagaContext);
      
      logger.info(`Saga ${sagaId}: Completed successfully`);
      
    } catch (error) {
      logger.error(`Saga ${sagaId}: Failed at step ${sagaContext.step}`, error);
      await this.compensate(sagaContext, error);
    }
  }
  
  async reserveInventory(sagaContext) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Inventory reservation timeout'));
      }, this.sagaTimeout);
      
      try {
        // Call inventory service to reserve stock
        const response = await axios.post(`${process.env.INVENTORY_SERVICE_URL}/api/v1/inventory/reserve`, {
          sagaId: sagaContext.sagaId,
          orderId: sagaContext.orderId,
          items: sagaContext.items
        }, {
          timeout: this.sagaTimeout - 5000
        });
        
        if (response.data.success) {
          sagaContext.step = 'reserve_inventory';
          sagaContext.compensationSteps.unshift({
            step: 'release_inventory',
            data: { items: sagaContext.items }
          });
          await this.updateSagaContext(sagaContext);
          clearTimeout(timeout);
          resolve();
        } else {
          reject(new Error(response.data.message || 'Inventory reservation failed'));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  async processPayment(sagaContext) {
    return new Promise(async (resolve, reject) => {
      const timeout = setTimeout(() => {
        reject(new Error('Payment processing timeout'));
      }, this.sagaTimeout);
      
      try {
        // Call payment service to process payment
        const response = await axios.post(`${process.env.PAYMENT_SERVICE_URL}/api/v1/payments/process`, {
          sagaId: sagaContext.sagaId,
          orderId: sagaContext.orderId,
          orderNumber: sagaContext.orderNumber,
          userId: sagaContext.userId,
          amount: sagaContext.total,
          currency: 'USD'
        }, {
          timeout: this.sagaTimeout - 5000
        });
        
        if (response.data.success) {
          sagaContext.step = 'process_payment';
          sagaContext.paymentTransactionId = response.data.transactionId;
          sagaContext.compensationSteps.unshift({
            step: 'refund_payment',
            data: { transactionId: response.data.transactionId, amount: sagaContext.total }
          });
          await this.updateSagaContext(sagaContext);
          clearTimeout(timeout);
          resolve();
        } else {
          reject(new Error(response.data.message || 'Payment processing failed'));
        }
      } catch (error) {
        clearTimeout(timeout);
        reject(error);
      }
    });
  }
  
  async confirmOrder(sagaContext) {
    // Update order status in database
    const Order = require('../models/Order.model');
    const order = await Order.findById(sagaContext.orderId);
    
    if (!order) {
      throw new Error('Order not found');
    }
    
    order.status = 'confirmed';
    order.saga = {
      step: 'complete',
      context: sagaContext
    };
    
    if (sagaContext.paymentTransactionId) {
      order.payment.transactionId = sagaContext.paymentTransactionId;
      order.payment.paymentStatus = 'completed';
      order.payment.paidAt = new Date();
    }
    
    await order.save();
    await order.addTimelineEntry('confirmed', 'Order confirmed');
    
    sagaContext.step = 'confirm_order';
    await this.updateSagaContext(sagaContext);
  }
  
  async sendNotifications(sagaContext) {
    try {
      // Publish order confirmed event for notification service
      await publishEvent('order.events', 'order.confirmed', {
        eventId: crypto.randomUUID(),
        eventType: 'order.confirmed',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'order-service',
        data: {
          orderId: sagaContext.orderId,
          orderNumber: sagaContext.orderNumber,
          userId: sagaContext.userId,
          total: sagaContext.total
        }
      });
    } catch (error) {
      logger.error('Failed to send notifications:', error);
      // Don't fail saga for notification errors
    }
  }
  
  async compensate(sagaContext, error) {
    logger.info(`Saga ${sagaContext.sagaId}: Starting compensation`);
    
    for (const compensationStep of sagaContext.compensationSteps) {
      let retries = 0;
      let success = false;
      
      while (retries < this.compensationRetryCount && !success) {
        try {
          await this.executeCompensationStep(compensationStep, sagaContext);
          success = true;
          logger.info(`Saga ${sagaContext.sagaId}: Compensation step ${compensationStep.step} succeeded`);
        } catch (compError) {
          retries++;
          logger.error(`Saga ${sagaContext.sagaId}: Compensation step ${compensationStep.step} failed (attempt ${retries}/${this.compensationRetryCount})`, compError);
          
          if (retries < this.compensationRetryCount) {
            await this.delay(this.compensationRetryDelay);
          }
        }
      }
      
      if (!success) {
        logger.error(`Saga ${sagaContext.sagaId}: Critical - Compensation step ${compensationStep.step} failed after all retries`);
        await this.alertManualIntervention(sagaContext, compensationStep);
      }
    }
    
    // Update order as failed
    const Order = require('../models/Order.model');
    const order = await Order.findById(sagaContext.orderId);
    if (order) {
      order.status = 'failed';
      order.saga = {
        step: 'failed',
        context: sagaContext,
        compensationAttempts: this.compensationRetryCount
      };
      await order.save();
      await order.addTimelineEntry('failed', `Order failed: ${error.message}`);
    }
    
    logger.error(`Saga ${sagaContext.sagaId}: Compensation completed with errors`);
  }
  
  async executeCompensationStep(compensationStep, sagaContext) {
    switch (compensationStep.step) {
      case 'release_inventory':
        await this.releaseInventory(compensationStep.data, sagaContext);
        break;
      case 'refund_payment':
        await this.refundPayment(compensationStep.data, sagaContext);
        break;
      default:
        logger.warn(`Unknown compensation step: ${compensationStep.step}`);
    }
  }
  
  async releaseInventory(data, sagaContext) {
    await axios.post(`${process.env.INVENTORY_SERVICE_URL}/api/v1/inventory/release`, {
      sagaId: sagaContext.sagaId,
      orderId: sagaContext.orderId,
      items: data.items
    });
  }
  
  async refundPayment(data, sagaContext) {
    await axios.post(`${process.env.PAYMENT_SERVICE_URL}/api/v1/payments/refund`, {
      transactionId: data.transactionId,
      amount: data.amount,
      reason: 'Order failed - Saga compensation'
    });
  }
  
  async updateSagaContext(sagaContext) {
    await setCache(`saga:${sagaContext.sagaId}`, sagaContext, 3600);
  }
  
  async alertManualIntervention(sagaContext, failedStep) {
    // Send alert for manual intervention
    logger.error(`Manual intervention required for saga ${sagaContext.sagaId}`, {
      sagaContext,
      failedStep
    });
    
    await publishEvent('notification.events', 'notification.alert', {
      eventId: crypto.randomUUID(),
      eventType: 'saga.failed',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'order-service',
      data: {
        sagaId: sagaContext.sagaId,
        orderId: sagaContext.orderId,
        failedStep: failedStep.step,
        message: 'Saga compensation failed - manual intervention required'
      }
    });
  }
  
  delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
  }
}

module.exports = { SagaOrchestrator };