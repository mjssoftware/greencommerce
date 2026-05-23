const mongoose = require('mongoose');
const dotenv = require('dotenv');
const Inventory = require('../src/models/Inventory.model');

dotenv.config();

const seedDatabase = async () => {
  try {
    await mongoose.connect(process.env.MONGODB_URI);
    console.log('Connected to MongoDB');
    
    // Sample inventory data
    const inventoryItems = [
      {
        productId: 'prod_iphone15',
        sku: 'APL-IP15P-001',
        name: 'iPhone 15 Pro',
        quantity: 100,
        reserved: 0,
        lowStockThreshold: 10,
        criticalStockThreshold: 5,
        trackInventory: true,
        allowBackorders: false,
        location: {
          warehouse: 'Main Warehouse',
          aisle: 'A-1',
          shelf: 'S-3',
          bin: 'B-12'
        },
        supplier: {
          id: 'sup_apple',
          name: 'Apple Inc.',
          sku: 'MPNH3LL/A',
          leadTime: 14
        },
        reorderPoint: 20,
        reorderQuantity: 50,
        metadata: {
          costPrice: 850.00,
          sellingPrice: 999.99,
          weight: 0.5,
          dimensions: {
            length: 15,
            width: 7,
            height: 0.8
          }
        }
      },
      {
        productId: 'prod_samsung24',
        sku: 'SAM-GS24-001',
        name: 'Samsung Galaxy S24',
        quantity: 150,
        reserved: 0,
        lowStockThreshold: 15,
        criticalStockThreshold: 8,
        trackInventory: true,
        allowBackorders: true,
        location: {
          warehouse: 'Main Warehouse',
          aisle: 'A-1',
          shelf: 'S-4',
          bin: 'B-8'
        },
        supplier: {
          id: 'sup_samsung',
          name: 'Samsung Electronics',
          sku: 'SM-S921B',
          leadTime: 10
        },
        reorderPoint: 25,
        reorderQuantity: 75,
        metadata: {
          costPrice: 750.00,
          sellingPrice: 899.99,
          weight: 0.48,
          dimensions: {
            length: 14.7,
            width: 7.1,
            height: 0.8
          }
        }
      },
      {
        productId: 'prod_nike_airmax',
        sku: 'NKE-AM-001',
        name: 'Nike Air Max',
        quantity: 5,
        reserved: 0,
        lowStockThreshold: 10,
        criticalStockThreshold: 5,
        trackInventory: true,
        allowBackorders: false,
        location: {
          warehouse: 'Clothing Warehouse',
          aisle: 'C-2',
          shelf: 'S-1',
          bin: 'B-45'
        },
        supplier: {
          id: 'sup_nike',
          name: 'Nike Inc.',
          sku: 'DM0829-001',
          leadTime: 21
        },
        reorderPoint: 15,
        reorderQuantity: 30,
        metadata: {
          costPrice: 80.00,
          sellingPrice: 129.99,
          weight: 0.8,
          dimensions: {
            length: 30,
            width: 20,
            height: 12
          }
        }
      }
    ];
    
    for (const item of inventoryItems) {
      const existing = await Inventory.findOne({ sku: item.sku });
      if (!existing) {
        const inventory = new Inventory(item);
        await inventory.save();
        console.log(`Created inventory for: ${item.name}`);
      } else {
        console.log(`Inventory already exists for: ${item.name}`);
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