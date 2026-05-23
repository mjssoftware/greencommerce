const { addToEmailQueue, addToSmsQueue } = require('../../services/queue.service');
const Notification = require('../../models/Notification.model');
const logger = require('../../utils/logger');

const handlePaymentSuccess = async (event) => {
  try {
    const {
      transactionId,
      orderId,
      userId,
      amount,
      currency = 'USD',
      paymentMethod,
      customerEmail,
      customerName,
      customerPhone,
      paymentDate,
      receiptUrl,
      last4,
    } = event.data;
    
    logger.info(`Processing payment success event for transaction: ${transactionId}`);
    
    // Create email receipt notification
    const emailNotification = new Notification({
      userId,
      type: 'email',
      channel: 'payment',
      title: `Payment Receipt - Order #${orderId}`,
      content: `Payment of $${amount} for order #${orderId} was successful`,
      data: {
        transactionId,
        orderId,
        amount,
        currency,
        paymentMethod,
        customerEmail,
        customerName,
        paymentDate,
        receiptUrl,
        last4,
        status: 'success',
      },
      priority: 'high',
      metadata: {
        eventType: 'payment.success',
        eventVersion: '1.0',
        transactionId,
      },
    });
    
    await emailNotification.save();
    
    // Send payment receipt email
    await addToEmailQueue({
      type: 'payment_receipt',
      data: {
        notificationId: emailNotification._id,
        transactionId,
        orderId,
        amount,
        currency,
        paymentMethod,
        customerEmail,
        customerName,
        paymentDate: paymentDate ? new Date(paymentDate).toLocaleString() : new Date().toLocaleString(),
        receiptUrl,
        last4: last4 || '****',
        status: 'success',
        supportEmail: process.env.SUPPORT_EMAIL,
        year: new Date().getFullYear(),
      },
    });
    
    // Send SMS confirmation
    if (customerPhone) {
      const smsNotification = new Notification({
        userId,
        type: 'sms',
        channel: 'payment',
        title: 'Payment Confirmation',
        content: `Payment of $${amount} for order #${orderId} was successful`,
        data: {
          transactionId,
          orderId,
          amount,
          customerPhone,
        },
        priority: 'high',
      });
      
      await smsNotification.save();
      
      await addToSmsQueue({
        type: 'payment_confirmation',
        data: {
          notificationId: smsNotification._id,
          phoneNumber: customerPhone,
          orderId,
          amount,
          transactionId,
        },
      });
    }
    
    // Create in-app notification
    const inAppNotification = new Notification({
      userId,
      type: 'in_app',
      channel: 'payment',
      title: 'Payment Successful 💰',
      content: `Your payment of $${amount} for order #${orderId} has been processed successfully.`,
      data: {
        transactionId,
        orderId,
        amount,
        paymentMethod,
      },
      priority: 'high',
    });
    
    await inAppNotification.save();
    
    // Send loyalty points notification if applicable
    const loyaltyPoints = Math.floor(amount * 10); // 10 points per dollar
    if (loyaltyPoints > 0) {
      const pointsNotification = new Notification({
        userId,
        type: 'email',
        channel: 'payment',
        title: 'Loyalty Points Earned! ⭐',
        content: `You earned ${loyaltyPoints} loyalty points from your purchase!`,
        data: {
          orderId,
          amount,
          loyaltyPoints,
        },
        priority: 'medium',
      });
      
      await pointsNotification.save();
      
      await addToEmailQueue({
        type: 'loyalty_points',
        data: {
          notificationId: pointsNotification._id,
          email: customerEmail,
          name: customerName,
          points: loyaltyPoints,
          orderId,
        },
      });
    }
    
    logger.info(`Payment success notifications sent for transaction: ${transactionId}`);
    
  } catch (error) {
    logger.error(`Error handling payment success event for transaction ${event.data.transactionId}:`, error);
    throw error;
  }
};

module.exports = { handlePaymentSuccess };