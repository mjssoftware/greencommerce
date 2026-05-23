const Category = require('../models/Category.model');
const Product = require('../models/Product.model');
const { getCache, setCache, deleteCache } = require('../config/redis');
const { ApiError } = require('../utils/api-error');
const logger = require('../utils/logger');

class CategoryService {
  async createCategory(categoryData) {
    const existingCategory = await Category.findOne({ name: categoryData.name });
    if (existingCategory) {
      throw new ApiError(409, 'Category already exists');
    }
    
    const category = new Category(categoryData);
    await category.save();
    
    await deleteCache('categories:list:*');
    await deleteCache('category:tree');
    
    return category;
  }
  
  async getAllCategories(query = {}) {
    const cacheKey = `categories:list:${JSON.stringify(query)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    
    const { isActive, parent } = query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    if (parent !== undefined) filter.parent = parent === 'null' ? null : parent;
    
    const categories = await Category.find(filter)
      .populate('parent', 'name slug')
      .sort('order');
    
    await setCache(cacheKey, categories, 3600);
    
    return categories;
  }
  
  async getCategoryById(id) {
    const cached = await getCache(`category:${id}`);
    if (cached) return cached;
    
    const category = await Category.findById(id)
      .populate('parent', 'name slug');
    
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    await setCache(`category:${id}`, category, 3600);
    
    return category;
  }
  
  async getCategoryBySlug(slug) {
    const cached = await getCache(`category:slug:${slug}`);
    if (cached) return cached;
    
    const category = await Category.findOne({ slug })
      .populate('parent', 'name slug');
    
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    await setCache(`category:slug:${slug}`, category, 3600);
    
    return category;
  }
  
  async updateCategory(id, updateData) {
    const category = await Category.findById(id);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    // Prevent circular parent reference
    if (updateData.parent && updateData.parent === id) {
      throw new ApiError(400, 'Category cannot be its own parent');
    }
    
    Object.assign(category, updateData);
    await category.save();
    
    await deleteCache(`category:${id}`);
    await deleteCache(`category:slug:${category.slug}`);
    await deleteCache('categories:list:*');
    await deleteCache('category:tree');
    
    return category;
  }
  
  async deleteCategory(id) {
    const category = await Category.findById(id);
    if (!category) {
      throw new ApiError(404, 'Category not found');
    }
    
    // Check if category has products
    const productCount = await Product.countDocuments({ category: id });
    if (productCount > 0) {
      throw new ApiError(400, `Cannot delete category with ${productCount} products`);
    }
    
    // Update children to have no parent
    await Category.updateMany({ parent: id }, { parent: null });
    
    await category.deleteOne();
    
    await deleteCache(`category:${id}`);
    await deleteCache('categories:list:*');
    await deleteCache('category:tree');
    
    return true;
  }
  
  async getCategoryTree() {
    const cached = await getCache('category:tree');
    if (cached) return cached;
    
    const tree = await Category.getTree();
    await setCache('category:tree', tree, 3600);
    
    return tree;
  }
  
  async getCategoryProducts(categoryId, page = 1, limit = 20) {
    const category = await this.getCategoryById(categoryId);
    
    const filter = {
      category: category._id,
      isActive: true
    };
    
    const products = await Product.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit)
      .populate('brand', 'name slug');
    
    const total = await Product.countDocuments(filter);
    
    return {
      category,
      products,
      pagination: {
        page: parseInt(page),
        limit: parseInt(limit),
        total,
        pages: Math.ceil(total / limit)
      }
    };
  }
}

module.exports = new CategoryService();