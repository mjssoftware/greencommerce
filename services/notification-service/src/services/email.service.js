const handlebars = require('handlebars');
const fs = require('fs').promises;
const path = require('path');
const { sendEmail } = require('../config/email');
const logger = require('../utils/logger');

class EmailService {
  constructor() {
    this.templates = {};
    this.loadTemplates();
  }
  
  async loadTemplates() {
    try {
      const templateDir = path.join(__dirname, '../templates/email');
      const files = await fs.readdir(templateDir);
      
      for (const file of files) {
        if (file.endsWith('.hbs')) {
          const templatePath = path.join(templateDir, file);
          const templateContent = await fs.readFile(templatePath, 'utf-8');
          const templateName = path.basename(file, '.hbs');
          this.templates[templateName] = handlebars.compile(templateContent);
          logger.info(`Loaded email template: ${templateName}`);
        }
      }
    } catch (error) {
      logger.error('Failed to load email templates:', error);
    }
  }
  
  async sendWelcomeEmail(userData) {
    const template = this.templates['welcome'];
    if (!template) {
      logger.error('Welcome template not found');
      return false;
    }
    
    const html = template({
      name: userData.name,
      email: userData.email,
      loginUrl: `${process.env.FRONTEND_URL}/login`,
      supportEmail: process.env.SUPPORT_EMAIL,
      year: new Date().getFullYear(),
    });
    
    return await sendEmail({
      to: userData.email,
      subject: 'Welcome to Our E-commerce Platform!',
      html,
    });
  }
  
  async sendOrderConfirmation(orderData) {
    const template = this.templates['order-confirmation'];
    if (!template) {
      logger.error('Order confirmation template not found');
      return false;
    }
    
    const html = template({
      orderId: orderData.orderId,
      customerName: orderData.customerName,
      orderDate: new Date(orderData.createdAt).toLocaleDateString(),
      items: orderData.items,
      subtotal: orderData.subtotal,
      shipping: orderData.shipping,
      tax: orderData.tax,
      total: orderData.total,
      shippingAddress: orderData.shippingAddress,
      estimatedDelivery: orderData.estimatedDelivery,
      orderUrl: `${process.env.FRONTEND_URL}/orders/${orderData.orderId}`,
      supportEmail: process.env.SUPPORT_EMAIL,
    });
    
    return await sendEmail({
      to: orderData.customerEmail,
      subject: `Order Confirmation #${orderData.orderId}`,
      html,
    });
  }
  
  async sendPaymentReceipt(paymentData) {
    const template = this.templates['payment-receipt'];
    if (!template) {
      logger.error('Payment receipt template not found');
      return false;
    }
    
    const html = template({
      transactionId: paymentData.transactionId,
      orderId: paymentData.orderId,
      amount: paymentData.amount,
      paymentMethod: paymentData.paymentMethod,
      paymentDate: new Date(paymentData.paymentDate).toLocaleString(),
      status: paymentData.status,
      customerName: paymentData.customerName,
      receiptUrl: paymentData.receiptUrl,
    });
    
    return await sendEmail({
      to: paymentData.customerEmail,
      subject: `Payment Receipt for Order #${paymentData.orderId}`,
      html,
    });
  }
  
  async sendPasswordReset(userData) {
    const template = this.templates['password-reset'];
    if (!template) {
      logger.error('Password reset template not found');
      return false;
    }
    
    const html = template({
      name: userData.name,
      resetLink: `${process.env.FRONTEND_URL}/reset-password?token=${userData.resetToken}`,
      expiryTime: '1 hour',
      supportEmail: process.env.SUPPORT_EMAIL,
    });
    
    return await sendEmail({
      to: userData.email,
      subject: 'Password Reset Request',
      html,
    });
  }
  
  async sendLowStockAlert(productData) {
    const template = this.templates['low-stock-alert'];
    if (!template) {
      logger.error('Low stock alert template not found');
      return false;
    }
    
    const html = template({
      productName: productData.name,
      sku: productData.sku,
      currentStock: productData.currentStock,
      threshold: productData.threshold,
      adminUrl: `${process.env.ADMIN_URL}/inventory/${productData.productId}`,
    });
    
    return await sendEmail({
      to: process.env.ADMIN_EMAIL,
      subject: `Low Stock Alert: ${productData.name}`,
      html,
    });
  }
}

module.exports = new EmailService();