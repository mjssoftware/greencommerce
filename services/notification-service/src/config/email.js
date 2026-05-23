const nodemailer = require('nodemailer');
const sgMail = require('@sendgrid/mail');
const logger = require('../utils/logger');

let transporter = null;

const initEmailService = () => {
  const provider = process.env.EMAIL_PROVIDER || 'nodemailer';
  
  if (provider === 'sendgrid') {
    sgMail.setApiKey(process.env.SENDGRID_API_KEY);
    logger.info('SendGrid email service initialized');
  } else {
    transporter = nodemailer.createTransport({
      host: process.env.SMTP_HOST,
      port: process.env.SMTP_PORT,
      secure: process.env.SMTP_SECURE === 'true',
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });
    logger.info('Nodemailer email service initialized');
  }
  
  return true;
};

const sendEmail = async ({ to, subject, html, text, attachments }) => {
  try {
    const from = process.env.SMTP_FROM || process.env.SENDGRID_FROM_EMAIL;
    
    if (process.env.EMAIL_PROVIDER === 'sendgrid') {
      const msg = {
        to,
        from,
        subject,
        html,
        text,
        attachments,
      };
      await sgMail.send(msg);
    } else {
      await transporter.sendMail({
        from,
        to,
        subject,
        html,
        text,
        attachments,
      });
    }
    
    logger.info(`Email sent to ${to} - Subject: ${subject}`);
    return true;
  } catch (error) {
    logger.error('Failed to send email:', error);
    throw error;
  }
};

module.exports = { initEmailService, sendEmail };