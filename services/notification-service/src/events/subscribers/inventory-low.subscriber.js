const { addToEmailQueue, addToSmsQueue } = require('../../services/queue.service');
const Notification = require('../../models/Notification.model');
const logger = require('../../utils/logger');

const handleInventoryLow = async (event) => {
  try {
    const {
      productId,
      name,
      sku,
      currentStock,
      threshold,
      category,
      supplierEmail,
      supplierPhone,
      supplierName,
    } = event.data;
    
    logger.info(`Processing inventory low event for product: ${productId} (${sku})`);
    
    const isCritical = currentStock <= 5;
    const priority = isCritical ? 'urgent' : 'high';
    
    // Send admin email alert
    const adminNotification = new Notification({
      userId: 'admin',
      type: 'email',
      channel: 'inventory',
      title: isCritical ? '⚠️ CRITICAL: Low Stock Alert' : 'Low Stock Alert',
      content: `${name} (SKU: ${sku}) is running low. Current stock: ${currentStock}`,
      data: {
        productId,
        name,
        sku,
        currentStock,
        threshold,
        category,
        isCritical,
      },
      priority: priority,
      metadata: {
        eventType: 'inventory.low',
        eventVersion: '1.0',
        productId,
      },
    });
    
    await adminNotification.save();
    
    await addToEmailQueue({
      type: 'low_stock',
      data: {
        notificationId: adminNotification._id,
        productId,
        name,
        sku,
        currentStock,
        threshold,
        adminUrl: `${process.env.ADMIN_URL}/inventory/${productId}`,
        year: new Date().getFullYear(),
      },
    });
    
    // Send SMS to inventory manager for critical stock
    if (isCritical && supplierPhone) {
      const smsNotification = new Notification({
        userId: 'inventory_manager',
        type: 'sms',
        channel: 'inventory',
        title: 'URGENT: Low Stock',
        content: `${name} (${sku}) has only ${currentStock} units left!`,
        data: {
          productId,
          name,
          sku,
          currentStock,
          supplierPhone,
        },
        priority: 'urgent',
      });
      
      await smsNotification.save();
      
      await addToSmsQueue({
        type: 'inventory_low',
        data: {
          notificationId: smsNotification._id,
          phoneNumber: supplierPhone,
          productName: name,
          sku,
          currentStock,
          threshold,
        },
      });
    }
    
    // Send email to supplier for reorder
    if (supplierEmail) {
      const supplierNotification = new Notification({
        userId: 'supplier',
        type: 'email',
        channel: 'inventory',
        title: `Reorder Request: ${name}`,
        content: `Please restock ${name} (SKU: ${sku}). Current stock: ${currentStock}`,
        data: {
          productId,
          name,
          sku,
          currentStock,
          threshold,
          supplierName,
        },
        priority: priority,
      });
      
      await supplierNotification.save();
      
      await addToEmailQueue({
        type: 'reorder_request',
        data: {
          notificationId: supplierNotification._id,
          email: supplierEmail,
          supplierName,
          productName: name,
          sku,
          quantity: threshold * 2, // Reorder double the threshold
          currentStock,
        },
      });
    }
    
    // Create dashboard notification for staff
    const dashboardNotification = new Notification({
      userId: 'admin',
      type: 'in_app',
      channel: 'inventory',
      title: isCritical ? '🔴 Critical Stock Alert' : '🟡 Low Stock Alert',
      content: `${name} (SKU: ${sku}) - Current stock: ${currentStock} (Threshold: ${threshold})`,
      data: {
        productId,
        name,
        sku,
        currentStock,
        threshold,
      },
      priority: priority,
    });
    
    await dashboardNotification.save();
    
    // If product is out of stock, send additional alerts
    if (currentStock === 0) {
      const outOfStockNotification = new Notification({
        userId: 'admin',
        type: 'email',
        channel: 'inventory',
        title: '🚨 OUT OF STOCK: Action Required',
        content: `${name} (SKU: ${sku}) is completely out of stock!`,
        data: {
          productId,
          name,
          sku,
        },
        priority: 'urgent',
      });
      
      await outOfStockNotification.save();
      
      await addToEmailQueue({
        type: 'out_of_stock',
        data: {
          notificationId: outOfStockNotification._id,
          email: process.env.ADMIN_EMAIL,
          productName: name,
          sku,
          adminUrl: `${process.env.ADMIN_URL}/inventory/${productId}`,
        },
      });
    }
    
    logger.info(`Inventory low notifications sent for product: ${productId}`);
    
    // Log to analytics
    // await publishToAnalytics('inventory.alert.sent', {
    //   productId,
    //   sku,
    //   currentStock,
    //   threshold,
    //   isCritical,
    // });
    
  } catch (error) {
    logger.error(`Error handling inventory low event for product ${event.data.productId}:`, error);
    throw error;
  }
};

module.exports = { handleInventoryLow };