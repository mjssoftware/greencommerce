const mongoose = require('mongoose');
const bcrypt = require('bcryptjs');
const dotenv = require('dotenv');
const { Role } = require('../src/models/Role.model');
const User = require('../src/models/User.model');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Initialize default roles
    await Role.initializeDefaultRoles();
    console.log('Default roles initialized');
    
    // Create admin user if not exists
    const adminEmail = process.env.ADMIN_EMAIL || 'admin@ecommerce.com';
    const existingAdmin = await User.findOne({ email: adminEmail });
    
    if (!existingAdmin) {
      const hashedPassword = await bcrypt.hash(
        process.env.ADMIN_PASSWORD || 'Admin@123456',
        10
      );
      
      const admin = new User({
        email: adminEmail,
        password: hashedPassword,
        firstName: 'Admin',
        lastName: 'User',
        roles: ['admin'],
        permissions: ['*'],
        emailVerified: true,
        status: 'active',
        metadata: {
          registeredAt: new Date(),
          registeredIP: '127.0.0.1'
        }
      });
      
      await admin.save();
      console.log('Admin user created');
    } else {
      console.log('Admin user already exists');
    }
    
    console.log('Database seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();