const { publishEvent } = require('../../config/rabbitmq');
const crypto = require('crypto');

class UserEventPublisher {
  static async userCreated(user) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.created',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        phoneNumber: user.phoneNumber,
        createdAt: user.createdAt
      }
    };
    
    await publishEvent('user.events', 'user.created', event);
  }
  
  static async userUpdated(user, changes) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId: user._id,
        email: user.email,
        changes
      }
    };
    
    await publishEvent('user.events', 'user.updated', event);
  }
  
  static async userDeleted(userId, email) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.deleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId,
        email
      }
    };
    
    await publishEvent('user.events', 'user.deleted', event);
  }
  
  static async userLogin(userId, email, ipAddress, userAgent) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.login',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId,
        email,
        ipAddress,
        userAgent,
        loginTime: new Date().toISOString()
      }
    };
    
    await publishEvent('user.events', 'user.login', event);
  }
  
  static async userLogout(userId) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.logout',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId,
        logoutTime: new Date().toISOString()
      }
    };
    
    await publishEvent('user.events', 'user.logout', event);
  }
  
  static async emailVerified(userId, email) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.email.verified',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId,
        email,
        verifiedAt: new Date().toISOString()
      }
    };
    
    await publishEvent('user.events', 'user.email.verified', event);
  }
  
  static async passwordChanged(userId) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.password.changed',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId,
        changedAt: new Date().toISOString()
      }
    };
    
    await publishEvent('user.events', 'user.password.changed', event);
  }
  
  static async roleUpdated(userId, oldRole, newRole) {
    const event = {
      eventId: crypto.randomUUID(),
      eventType: 'user.role.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'auth-service',
      data: {
        userId,
        oldRole,
        newRole,
        updatedAt: new Date().toISOString()
      }
    };
    
    await publishEvent('user.events', 'user.role.updated', event);
  }
}

module.exports = UserEventPublisher;