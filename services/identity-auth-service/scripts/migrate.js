const mongoose = require('mongoose');
const dotenv = require('dotenv');

dotenv.config();

const migrations = [
  {
    version: '1.0.0',
    name: 'Add email verification tokens',
    async up() {
      await mongoose.connection.collection('users').updateMany(
        { emailVerificationToken: { $exists: false } },
        { $set: { emailVerificationToken: null, emailVerificationExpires: null } }
      );
      console.log('Migration 1.0.0 completed');
    }
  },
  {
    version: '1.1.0',
    name: 'Add two-factor authentication fields',
    async up() {
      await mongoose.connection.collection('users').updateMany(
        { twoFactorEnabled: { $exists: false } },
        { $set: { twoFactorEnabled: false, twoFactorSecret: null } }
      );
      console.log('Migration 1.1.0 completed');
    }
  }
];

const runMigrations = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    for (const migration of migrations) {
      console.log(`Running migration: ${migration.name}`);
      await migration.up();
    }
    
    console.log('All migrations completed');
    process.exit(0);
  } catch (error) {
    console.error('Migration failed:', error);
    process.exit(1);
  }
};

runMigrations();