const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Category = require('../src/models/Category.model');
const Brand = require('../src/models/Brand.model');
const Product = require('../src/models/Product.model');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Create categories
    const categories = [
      { name: 'Electronics', description: 'Electronic devices and gadgets', isActive: true },
      { name: 'Clothing', description: 'Fashion and apparel', isActive: true },
      { name: 'Books', description: 'Books and publications', isActive: true },
      { name: 'Home & Garden', description: 'Home decor and garden supplies', isActive: true }
    ];
    
    const createdCategories = [];
    for (const category of categories) {
      const existing = await Category.findOne({ name: category.name });
      if (!existing) {
        const created = await Category.create(category);
        createdCategories.push(created);
        console.log(`Created category: ${created.name}`);
      } else {
        createdCategories.push(existing);
        console.log(`Category already exists: ${existing.name}`);
      }
    }
    
    // Create brands
    const brands = [
      { name: 'Apple', description: 'Apple Inc.', isActive: true },
      { name: 'Samsung', description: 'Samsung Electronics', isActive: true },
      { name: 'Nike', description: 'Nike Inc.', isActive: true },
      { name: 'Adidas', description: 'Adidas AG', isActive: true }
    ];
    
    const createdBrands = [];
    for (const brand of brands) {
      const existing = await Brand.findOne({ name: brand.name });
      if (!existing) {
        const created = await Brand.create(brand);
        createdBrands.push(created);
        console.log(`Created brand: ${created.name}`);
      } else {
        createdBrands.push(existing);
        console.log(`Brand already exists: ${existing.name}`);
      }
    }
    
    // Create sample products
    const products = [
      {
        name: 'iPhone 15 Pro',
        sku: 'APL-IP15P-001',
        description: 'Latest iPhone with A17 Pro chip',
        price: 999.99,
        category: createdCategories.find(c => c.name === 'Electronics')._id,
        brand: createdBrands.find(b => b.name === 'Apple')._id,
        inventory: { quantity: 100, trackInventory: true },
        isActive: true,
        isFeatured: true
      },
      {
        name: 'Samsung Galaxy S24',
        sku: 'SAM-GS24-001',
        description: 'Latest Samsung flagship phone',
        price: 899.99,
        category: createdCategories.find(c => c.name === 'Electronics')._id,
        brand: createdBrands.find(b => b.name === 'Samsung')._id,
        inventory: { quantity: 150, trackInventory: true },
        isActive: true,
        isFeatured: true
      },
      {
        name: 'Nike Air Max',
        sku: 'NKE-AM-001',
        description: 'Comfortable running shoes',
        price: 129.99,
        category: createdCategories.find(c => c.name === 'Clothing')._id,
        brand: createdBrands.find(b => b.name === 'Nike')._id,
        inventory: { quantity: 200, trackInventory: true },
        isActive: true,
        isFeatured: false
      }
    ];
    
    for (const product of products) {
      const existing = await Product.findOne({ sku: product.sku });
      if (!existing) {
        await Product.create(product);
        console.log(`Created product: ${product.name}`);
      } else {
        console.log(`Product already exists: ${product.name}`);
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