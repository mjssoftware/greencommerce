const { addToEmailQueue, addToSmsQueue } = require('../../services/queue.service');
const Notification = require('../../models/Notification.model');
const logger = require('../../utils/logger');

const handleOrderCreated = async (event) => {
  try {
    const {
      orderId,
      userId,
      customerEmail,
      customerName,
      customerPhone,
      items,
      subtotal,
      shipping,
      tax,
      total,
      shippingAddress,
      paymentMethod,
      estimatedDelivery,
    } = event.data;
    
    logger.info(`Processing order created event for order: ${orderId}`);
    
    // Calculate item details
    const itemsWithTotals = items.map(item => ({
      ...item,
      total: item.price * item.quantity,
    }));
    
    // Create email notification
    const emailNotification = new Notification({
      userId,
      type: 'email',
      channel: 'order',
      title: `Order Confirmation #${orderId}`,
      content: `Your order has been confirmed. Total: $${total}`,
      data: {
        orderId,
        customerEmail,
        customerName,
        items: itemsWithTotals,
        subtotal,
        shipping,
        tax,
        total,
        shippingAddress,
        paymentMethod,
        estimatedDelivery,
        createdAt: new Date(),
      },
      priority: 'high',
      metadata: {
        eventType: 'order.created',
        eventVersion: '1.0',
        orderTotal: total,
      },
    });
    
    await emailNotification.save();
    
    // Queue order confirmation email
    await addToEmailQueue({
      type: 'order_confirmation',
      data: {
        notificationId: emailNotification._id,
        orderId,
        customerEmail,
        customerName,
        items: itemsWithTotals,
        subtotal,
        shipping,
        tax,
        total,
        shippingAddress,
        orderDate: new Date().toLocaleDateString(),
        estimatedDelivery,
        orderUrl: `${process.env.FRONTEND_URL}/orders/${orderId}`,
        supportEmail: process.env.SUPPORT_EMAIL,
        year: new Date().getFullYear(),
      },
    });
    
    // Send SMS confirmation if phone number provided
    if (customerPhone) {
      const smsNotification = new Notification({
        userId,
        type: 'sms',
        channel: 'order',
        title: 'Order Confirmed',
        content: `Order #${orderId} confirmed. Total: $${total}`,
        data: {
          orderId,
          total,
          customerPhone,
        },
        priority: 'high',
      });
      
      await smsNotification.save();
      
      await addToSmsQueue({
        type: 'order_confirmation',
        data: {
          notificationId: smsNotification._id,
          phoneNumber: customerPhone,
          orderId,
          total,
        },
      });
    }
    
    // Create in-app notification
    const inAppNotification = new Notification({
      userId,
      type: 'in_app',
      channel: 'order',
      title: 'Order Confirmed! ✅',
      content: `Your order #${orderId} has been confirmed. We'll notify you when it ships.`,
      data: {
        orderId,
        total,
        status: 'confirmed',
      },
      priority: 'high',
    });
    
    await inAppNotification.save();
    
    // Send admin notification for high-value orders
    if (total > 1000) {
      const adminNotification = new Notification({
        userId: 'admin',
        type: 'email',
        channel: 'order',
        title: 'High Value Order Alert',
        content: `Order #${orderId} for $${total} requires attention`,
        data: {
          orderId,
          total,
          customerName,
          items: items.length,
        },
        priority: 'urgent',
      });
      
      await adminNotification.save();
      
      await addToEmailQueue({
        type: 'high_value_order',
        data: {
          notificationId: adminNotification._id,
          email: process.env.ADMIN_EMAIL,
          orderId,
          total,
          customerName,
          adminUrl: `${process.env.ADMIN_URL}/orders/${orderId}`,
        },
      });
    }
    
    logger.info(`Order confirmation notifications sent for order: ${orderId}`);
    
  } catch (error) {
    logger.error(`Error handling order created event for order ${event.data.orderId}:`, error);
    throw error;
  }
};

module.exports = { handleOrderCreated };