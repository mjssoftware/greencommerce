const { searchProducts, getEsClient } = require('../config/elasticsearch');
const Product = require('../models/Product.model');
const logger = require('../utils/logger');

class SearchService {
  async search(query, filters = {}, page = 1, limit = 20) {
    try {
      // Try Elasticsearch first
      const esResults = await searchProducts(query, filters, page, limit);
      if (esResults) return esResults;
      
      // Fallback to MongoDB
      return await this.mongoSearch(query, filters, page, limit);
    } catch (error) {
      logger.error('Search failed:', error);
      return await this.mongoSearch(query, filters, page, limit);
    }
  }
  
  async mongoSearch(query, filters = {}, page = 1, limit = 20) {
    const searchQuery = {};
    
    if (query) {
      searchQuery.$text = { $search: query };
    }
    
    if (filters.category) {
      searchQuery.category = filters.category;
    }
    
    if (filters.brand) {
      searchQuery.brand = filters.brand;
    }
    
    if (filters.minPrice || filters.maxPrice) {
      searchQuery.price = {};
      if (filters.minPrice) searchQuery.price.$gte = filters.minPrice;
      if (filters.maxPrice) searchQuery.price.$lte = filters.maxPrice;
    }
    
    if (filters.isActive !== undefined) {
      searchQuery.isActive = filters.isActive;
    }
    
    const products = await Product.find(searchQuery)
      .populate('category', 'name slug')
      .populate('brand', 'name slug')
      .limit(limit)
      .skip((page - 1) * limit);
    
    const total = await Product.countDocuments(searchQuery);
    
    return {
      products,
      total,
      page,
      limit,
      totalPages: Math.ceil(total / limit)
    };
  }
  
  async getSuggestions(query, limit = 10) {
    const suggestions = await Product.aggregate([
      {
        $match: {
          name: { $regex: query, $options: 'i' },
          isActive: true
        }
      },
      {
        $group: {
          _id: '$name',
          count: { $sum: 1 }
        }
      },
      { $sort: { count: -1 } },
      { $limit: limit }
    ]);
    
    return suggestions.map(s => s._id);
  }
  
  async syncAllProducts() {
    const esClient = getEsClient();
    if (!esClient) return;
    
    const products = await Product.find({ isActive: true });
    
    for (const product of products) {
      await esClient.index({
        index: process.env.ELASTICSEARCH_INDEX || 'products',
        id: product._id.toString(),
        document: {
          id: product._id.toString(),
          name: product.name,
          description: product.description,
          category: product.category,
          brand: product.brand,
          price: product.price,
          sku: product.sku,
          tags: product.tags,
          isActive: product.isActive
        }
      });
    }
    
    logger.info(`Synced ${products.length} products to Elasticsearch`);
  }
}

module.exports = new SearchService();