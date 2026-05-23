const Product = require('../models/Product.model');
const Category = require('../models/Category.model');
const Brand = require('../models/Brand.model');
const { getCache, setCache, deleteCache, clearProductCache } = require('../config/redis');
const { indexProduct, deleteProductFromIndex, searchProducts } = require('../config/elasticsearch');
const { publishEvent } = require('../config/rabbitmq');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');
const crypto = require('crypto');

class ProductService {
  async createProduct(productData, userId) {
    // Check if SKU exists
    const existingProduct = await Product.findOne({ sku: productData.sku });
    if (existingProduct) {
      throw new ApiError(409, 'Product with this SKU already exists');
    }
    
    // Verify category exists
    if (productData.category) {
      const category = await Category.findById(productData.category);
      if (!category) {
        throw new ApiError(404, 'Category not found');
      }
    }
    
    // Verify brand exists
    if (productData.brand) {
      const brand = await Brand.findById(productData.brand);
      if (!brand) {
        throw new ApiError(404, 'Brand not found');
      }
    }
    
    const product = new Product({
      ...productData,
      createdBy: userId,
      updatedBy: userId
    });
    
    await product.save();
    
    // Update category product count
    if (product.category) {
      await Category.findByIdAndUpdate(product.category, { $inc: { productCount: 1 } });
    }
    
    // Update brand product count
    if (product.brand) {
      await Brand.findByIdAndUpdate(product.brand, { $inc: { productCount: 1 } });
    }
    
    // Index in Elasticsearch
    await indexProduct(product);
    
    // Publish event
    await publishEvent('product.events', 'product.created', {
      eventId: crypto.randomUUID(),
      eventType: 'product.created',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'product-service',
      data: {
        productId: product._id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        category: product.category,
        quantity: product.inventory.quantity
      }
    });
    
    // Clear cache
    await deleteCache('products:list:*');
    await deleteCache('products:featured');
    
    return product;
  }
  
  async getProductById(productId, cached = true) {
    if (cached) {
      const cachedProduct = await getCache(`product:${productId}`);
      if (cachedProduct) return cachedProduct;
    }
    
    const product = await Product.findById(productId)
      .populate('category', 'name slug')
      .populate('brand', 'name slug logo');
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Increment views
    product.views += 1;
    await product.save();
    
    await setCache(`product:${productId}`, product, 3600);
    
    return product;
  }
  
  async getProductBySlug(slug, cached = true) {
    if (cached) {
      const cachedProduct = await getCache(`product:slug:${slug}`);
      if (cachedProduct) return cachedProduct;
    }
    
    const product = await Product.findOne({ slug })
      .populate('category', 'name slug')
      .populate('brand', 'name slug logo');
    
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    await setCache(`product:slug:${slug}`, product, 3600);
    
    return product;
  }
  
  async getAllProducts(query) {
    const cacheKey = `products:list:${JSON.stringify(query)}`;
    const cachedResult = await getCache(cacheKey);
    if (cachedResult) return cachedResult;
    
    const {
      page = 1,
      limit = 20,
      search,
      category,
      brand,
      minPrice,
      maxPrice,
      sortBy = 'createdAt',
      sortOrder = 'desc',
      isActive,
      isFeatured,
      tags,
      inStock
    } = query;
    
    const filter = {};
    
    if (search) {
      filter.$text = { $search: search };
    }
    
    if (category) {
      filter.category = category;
    }
    
    if (brand) {
      filter.brand = brand;
    }
    
    if (minPrice || maxPrice) {
      filter.price = {};
      if (minPrice) filter.price.$gte = parseFloat(minPrice);
      if (maxPrice) filter.price.$lte = parseFloat(maxPrice);
    }
    
    if (isActive !== undefined) {
      filter.isActive = isActive === 'true';
    }
    
    if (isFeatured !== undefined) {
      filter.isFeatured = isFeatured === 'true';
    }
    
    if (tags) {
      filter.tags = { $in: tags.split(',') };
    }
    
    if (inStock === 'true') {
      filter['inventory.trackInventory'] = true;
      filter.$expr = { $gt: ['$inventory.quantity', '$inventory.reserved'] };
    }
    
    const sort = {};
    sort[sortBy] = sortOrder === 'desc' ? -1 : 1;
    
    const products = await Product.find(filter)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .sort(sort)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Product.countDocuments(filter);
    
    const result = {
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
    
    await setCache(cacheKey, result, 300); // Cache for 5 minutes
    
    return result;
  }
  
  async updateProduct(productId, updateData, userId) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    // Check if SKU is being changed and is unique
    if (updateData.sku && updateData.sku !== product.sku) {
      const existingProduct = await Product.findOne({ sku: updateData.sku });
      if (existingProduct) {
        throw new ApiError(409, 'Product with this SKU already exists');
      }
    }
    
    // Handle category change
    if (updateData.category && updateData.category !== product.category) {
      await Category.findByIdAndUpdate(product.category, { $inc: { productCount: -1 } });
      await Category.findByIdAndUpdate(updateData.category, { $inc: { productCount: 1 } });
    }
    
    // Handle brand change
    if (updateData.brand && updateData.brand !== product.brand) {
      await Brand.findByIdAndUpdate(product.brand, { $inc: { productCount: -1 } });
      await Brand.findByIdAndUpdate(updateData.brand, { $inc: { productCount: 1 } });
    }
    
    Object.assign(product, updateData);
    product.updatedBy = userId;
    await product.save();
    
    // Update Elasticsearch
    await indexProduct(product);
    
    // Publish event
    await publishEvent('product.events', 'product.updated', {
      eventId: crypto.randomUUID(),
      eventType: 'product.updated',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'product-service',
      data: {
        productId: product._id,
        sku: product.sku,
        name: product.name,
        price: product.price,
        updates: Object.keys(updateData)
      }
    });
    
    // Clear cache
    await clearProductCache(productId);
    
    return product;
  }
  
  async deleteProduct(productId, hardDelete = false) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    if (hardDelete) {
      await product.deleteOne();
      
      // Update counts
      await Category.findByIdAndUpdate(product.category, { $inc: { productCount: -1 } });
      if (product.brand) {
        await Brand.findByIdAndUpdate(product.brand, { $inc: { productCount: -1 } });
      }
      
      // Delete from Elasticsearch
      await deleteProductFromIndex(productId);
    } else {
      product.isActive = false;
      await product.save();
    }
    
    // Publish event
    await publishEvent('product.events', 'product.deleted', {
      eventId: crypto.randomUUID(),
      eventType: 'product.deleted',
      version: '1.0',
      timestamp: new Date().toISOString(),
      source: 'product-service',
      data: {
        productId: product._id,
        sku: product.sku,
        hardDelete
      }
    });
    
    // Clear cache
    await clearProductCache(productId);
    
    return true;
  }
  
  async getFeaturedProducts(limit = 10) {
    const cacheKey = 'products:featured';
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    
    const products = await Product.find({ isFeatured: true, isActive: true })
      .limit(limit)
      .populate('category', 'name slug')
      .populate('brand', 'name slug');
    
    await setCache(cacheKey, products, 1800); // Cache for 30 minutes
    
    return products;
  }
  
  async searchProducts(query, filters, page, limit) {
    // Try Elasticsearch first
    const esResults = await searchProducts(query, filters, page, limit);
    if (esResults) return esResults;
    
    // Fallback to MongoDB text search
    return await this.getAllProducts({ search: query, ...filters, page, limit });
  }
  
  async updateInventory(productId, quantity, operation = 'deduct') {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    if (operation === 'deduct') {
      if (product.inventory.quantity < quantity) {
        throw new ApiError(400, 'Insufficient inventory');
      }
      product.inventory.quantity -= quantity;
    } else if (operation === 'add') {
      product.inventory.quantity += quantity;
    }
    
    await product.save();
    
    // Check if low stock
    if (product.inventory.quantity <= product.inventory.lowStockThreshold) {
      await publishEvent('inventory.events', 'inventory.low', {
        eventId: crypto.randomUUID(),
        eventType: 'inventory.low',
        version: '1.0',
        timestamp: new Date().toISOString(),
        source: 'product-service',
        data: {
          productId: product._id,
          name: product.name,
          sku: product.sku,
          currentStock: product.inventory.quantity,
          threshold: product.inventory.lowStockThreshold
        }
      });
    }
    
    await clearProductCache(productId);
    
    return product;
  }
  
  async getProductStats() {
    const total = await Product.countDocuments();
    const active = await Product.countDocuments({ isActive: true });
    const featured = await Product.countDocuments({ isFeatured: true });
    const outOfStock = await Product.countDocuments({
      'inventory.trackInventory': true,
      $expr: { $lte: ['$inventory.quantity', '$inventory.reserved'] }
    });
    
    const categories = await Category.aggregate([
      { $match: { isActive: true } },
      { $project: { name: 1, productCount: 1 } },
      { $sort: { productCount: -1 } },
      { $limit: 10 }
    ]);
    
    const priceRange = await Product.aggregate([
      { $match: { isActive: true } },
      {
        $group: {
          _id: null,
          minPrice: { $min: '$price' },
          maxPrice: { $max: '$price' },
          avgPrice: { $avg: '$price' }
        }
      }
    ]);
    
    return {
      total,
      active,
      featured,
      outOfStock,
      topCategories: categories,
      priceRange: priceRange[0] || { minPrice: 0, maxPrice: 0, avgPrice: 0 }
    };
  }
  
  async getRelatedProducts(productId, limit = 6) {
    const product = await Product.findById(productId);
    if (!product) {
      throw new ApiError(404, 'Product not found');
    }
    
    const related = await Product.find({
      _id: { $ne: productId },
      isActive: true,
      $or: [
        { category: product.category },
        { brand: product.brand },
        { tags: { $in: product.tags } }
      ]
    })
    .limit(limit)
    .populate('category', 'name slug')
    .populate('brand', 'name slug');
    
    return related;
  }
}

module.exports = new ProductService();