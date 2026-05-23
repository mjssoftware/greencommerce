const twilio = require('twilio');
const logger = require('../utils/logger');

let twilioClient = null;

const initSmsService = () => {
  if (!process.env.TWILIO_ACCOUNT_SID || !process.env.TWILIO_AUTH_TOKEN) {
    logger.warn('Twilio credentials not configured');
    return false;
  }
  
  twilioClient = twilio(
    process.env.TWILIO_ACCOUNT_SID,
    process.env.TWILIO_AUTH_TOKEN
  );
  
  logger.info('Twilio SMS service initialized');
  return true;
};

const sendSms = async ({ to, body }) => {
  try {
    if (!twilioClient) {
      throw new Error('Twilio client not initialized');
    }
    
    const message = await twilioClient.messages.create({
      body,
      to,
      from: process.env.TWILIO_PHONE_NUMBER,
    });
    
    logger.info(`SMS sent to ${to} - SID: ${message.sid}`);
    return message;
  } catch (error) {
    logger.error('Failed to send SMS:', error);
    throw error;
  }
};

module.exports = { initSmsService, sendSms };