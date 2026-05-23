const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Order = require('../src/models/Order.model');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Create sample orders
    const sampleOrders = [
      {
        userId: 'user_001',
        customer: {
          email: 'john@example.com',
          name: 'John Doe',
          phone: '+1234567890'
        },
        items: [{
          productId: 'prod_001',
          sku: 'PROD-001',
          name: 'Sample Product',
          quantity: 2,
          price: 49.99,
          total: 99.98
        }],
        summary: {
          subtotal: 99.98,
          discount: 0,
          tax: 10.00,
          shipping: 5.00,
          total: 114.98
        },
        status: 'delivered',
        shipping: {
          address: {
            street: '123 Main St',
            city: 'New York',
            state: 'NY',
            country: 'USA',
            zipCode: '10001'
          },
          method: 'standard',
          trackingNumber: 'TRK123456',
          carrier: 'UPS',
          shippedAt: new Date(),
          deliveredAt: new Date()
        }
      }
    ];
    
    for (const order of sampleOrders) {
      const existing = await Order.findOne({ orderNumber: order.orderNumber });
      if (!existing) {
        const newOrder = new Order(order);
        await newOrder.save();
        console.log(`Created order: ${newOrder.orderNumber}`);
      }
    }
    
    console.log('Database seeding completed');
    process.exit(0);
  } catch (error) {
    console.error('Error seeding database:', error);
    process.exit(1);
  }
};

seedDatabase();