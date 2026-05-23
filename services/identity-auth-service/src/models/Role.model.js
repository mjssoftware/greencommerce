const mongoose = require('mongoose');

const roleSchema = new mongoose.Schema({
  name: {
    type: String,
    required: true,
    unique: true,
    enum: ['user', 'admin', 'moderator', 'support']
  },
  description: {
    type: String,
    required: true
  },
  permissions: [{
    type: String,
    enum: [
      // User permissions
      'user:read',
      'user:write',
      'user:delete',
      // Product permissions
      'product:read',
      'product:write',
      'product:delete',
      // Order permissions
      'order:read',
      'order:write',
      'order:delete',
      // Admin permissions
      'admin:access',
      'admin:users',
      'admin:roles',
      'admin:settings',
      // Support permissions
      'support:read',
      'support:write'
    ]
  }],
  isDefault: {
    type: Boolean,
    default: false
  },
  level: {
    type: Number,
    min: 0,
    max: 100,
    default: 0
  }
}, {
  timestamps: true
});

// Predefined roles
const predefinedRoles = {
  user: {
    name: 'user',
    description: 'Regular user with basic permissions',
    permissions: ['user:read', 'product:read', 'order:read', 'order:write'],
    level: 10,
    isDefault: true
  },
  moderator: {
    name: 'moderator',
    description: 'Moderator with product management permissions',
    permissions: ['product:read', 'product:write', 'order:read', 'user:read'],
    level: 30,
    isDefault: false
  },
  support: {
    name: 'support',
    description: 'Support staff with order and user management',
    permissions: ['user:read', 'order:read', 'order:write', 'support:read', 'support:write'],
    level: 40,
    isDefault: false
  },
  admin: {
    name: 'admin',
    description: 'Administrator with full access',
    permissions: ['*'],
    level: 100,
    isDefault: false
  }
};

// Initialize default roles
roleSchema.statics.initializeDefaultRoles = async function() {
  try {
    for (const [key, roleData] of Object.entries(predefinedRoles)) {
      await this.findOneAndUpdate(
        { name: key },
        roleData,
        { upsert: true, new: true }
      );
    }
    console.log('Default roles initialized');
  } catch (error) {
    console.error('Error initializing roles:', error);
  }
};

const Role = mongoose.model('Role', roleSchema);

module.exports = { Role, predefinedRoles };