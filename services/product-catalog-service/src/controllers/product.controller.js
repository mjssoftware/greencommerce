const ProductService = require('../services/product.service');
const SearchService = require('../services/search.service');
const { ApiResponse } = require('../utils/api-response');
const logger = require('../utils/logger');

class ProductController {
  async createProduct(req, res, next) {
    try {
      const product = await ProductService.createProduct(req.body, req.user.id);
      ApiResponse.success(res, {
        message: 'Product created successfully',
        data: product
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async getProductById(req, res, next) {
    try {
      const product = await ProductService.getProductById(req.params.id);
      ApiResponse.success(res, { data: product });
    } catch (error) {
      next(error);
    }
  }
  
  async getProductBySlug(req, res, next) {
    try {
      const product = await ProductService.getProductBySlug(req.params.slug);
      ApiResponse.success(res, { data: product });
    } catch (error) {
      next(error);
    }
  }
  
  async getAllProducts(req, res, next) {
    try {
      const result = await ProductService.getAllProducts(req.query);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async updateProduct(req, res, next) {
    try {
      const product = await ProductService.updateProduct(req.params.id, req.body, req.user.id);
      ApiResponse.success(res, {
        message: 'Product updated successfully',
        data: product
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteProduct(req, res, next) {
    try {
      const { hardDelete } = req.query;
      await ProductService.deleteProduct(req.params.id, hardDelete === 'true');
      ApiResponse.success(res, { message: 'Product deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async getFeaturedProducts(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 10;
      const products = await ProductService.getFeaturedProducts(limit);
      ApiResponse.success(res, { data: products });
    } catch (error) {
      next(error);
    }
  }
  
  async searchProducts(req, res, next) {
    try {
      const { q, category, brand, minPrice, maxPrice, page, limit } = req.query;
      const result = await SearchService.search(q, { category, brand, minPrice, maxPrice }, page, limit);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
  
  async getProductSuggestions(req, res, next) {
    try {
      const { q, limit } = req.query;
      const suggestions = await SearchService.getSuggestions(q, limit);
      ApiResponse.success(res, { data: suggestions });
    } catch (error) {
      next(error);
    }
  }
  
  async getProductStats(req, res, next) {
    try {
      const stats = await ProductService.getProductStats();
      ApiResponse.success(res, { data: stats });
    } catch (error) {
      next(error);
    }
  }
  
  async getRelatedProducts(req, res, next) {
    try {
      const limit = parseInt(req.query.limit) || 6;
      const products = await ProductService.getRelatedProducts(req.params.id, limit);
      ApiResponse.success(res, { data: products });
    } catch (error) {
      next(error);
    }
  }
  
  async updateInventory(req, res, next) {
    try {
      const { productId } = req.params;
      const { quantity, operation } = req.body;
      const product = await ProductService.updateInventory(productId, quantity, operation);
      ApiResponse.success(res, {
        message: 'Inventory updated successfully',
        data: { inventory: product.inventory }
      });
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new ProductController();