const CategoryService = require('../services/category.service');
const { ApiResponse } = require('../utils/api-response');

class CategoryController {
  async createCategory(req, res, next) {
    try {
      const category = await CategoryService.createCategory(req.body);
      ApiResponse.success(res, {
        message: 'Category created successfully',
        data: category
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async getAllCategories(req, res, next) {
    try {
      const categories = await CategoryService.getAllCategories(req.query);
      ApiResponse.success(res, { data: categories });
    } catch (error) {
      next(error);
    }
  }
  
  async getCategoryById(req, res, next) {
    try {
      const category = await CategoryService.getCategoryById(req.params.id);
      ApiResponse.success(res, { data: category });
    } catch (error) {
      next(error);
    }
  }
  
  async getCategoryBySlug(req, res, next) {
    try {
      const category = await CategoryService.getCategoryBySlug(req.params.slug);
      ApiResponse.success(res, { data: category });
    } catch (error) {
      next(error);
    }
  }
  
  async updateCategory(req, res, next) {
    try {
      const category = await CategoryService.updateCategory(req.params.id, req.body);
      ApiResponse.success(res, {
        message: 'Category updated successfully',
        data: category
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteCategory(req, res, next) {
    try {
      await CategoryService.deleteCategory(req.params.id);
      ApiResponse.success(res, { message: 'Category deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async getCategoryTree(req, res, next) {
    try {
      const tree = await CategoryService.getCategoryTree();
      ApiResponse.success(res, { data: tree });
    } catch (error) {
      next(error);
    }
  }
  
  async getCategoryProducts(req, res, next) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;
      const result = await CategoryService.getCategoryProducts(id, page, limit);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new CategoryController();