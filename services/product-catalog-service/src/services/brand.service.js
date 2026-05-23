const Brand = require('../models/Brand.model');
const Product = require('../models/Product.model');
const { getCache, setCache, deleteCache } = require('../config/redis');
const { ApiError } = require('../utils/api-error');

class BrandService {
  async createBrand(brandData) {
    const existingBrand = await Brand.findOne({ name: brandData.name });
    if (existingBrand) {
      throw new ApiError(409, 'Brand already exists');
    }
    
    const brand = new Brand(brandData);
    await brand.save();
    
    await deleteCache('brands:list:*');
    
    return brand;
  }
  
  async getAllBrands(query = {}) {
    const cacheKey = `brands:list:${JSON.stringify(query)}`;
    const cached = await getCache(cacheKey);
    if (cached) return cached;
    
    const { isActive } = query;
    const filter = {};
    if (isActive !== undefined) filter.isActive = isActive === 'true';
    
    const brands = await Brand.find(filter).sort('order');
    
    await setCache(cacheKey, brands, 3600);
    
    return brands;
  }
  
  async getBrandById(id) {
    const cached = await getCache(`brand:${id}`);
    if (cached) return cached;
    
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new ApiError(404, 'Brand not found');
    }
    
    await setCache(`brand:${id}`, brand, 3600);
    
    return brand;
  }
  
  async getBrandBySlug(slug) {
    const cached = await getCache(`brand:slug:${slug}`);
    if (cached) return cached;
    
    const brand = await Brand.findOne({ slug });
    if (!brand) {
      throw new ApiError(404, 'Brand not found');
    }
    
    await setCache(`brand:slug:${slug}`, brand, 3600);
    
    return brand;
  }
  
  async updateBrand(id, updateData) {
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new ApiError(404, 'Brand not found');
    }
    
    Object.assign(brand, updateData);
    await brand.save();
    
    await deleteCache(`brand:${id}`);
    await deleteCache(`brand:slug:${brand.slug}`);
    await deleteCache('brands:list:*');
    
    return brand;
  }
  
  async deleteBrand(id) {
    const brand = await Brand.findById(id);
    if (!brand) {
      throw new ApiError(404, 'Brand not found');
    }
    
    // Check if brand has products
    const productCount = await Product.countDocuments({ brand: id });
    if (productCount > 0) {
      throw new ApiError(400, `Cannot delete brand with ${productCount} products`);
    }
    
    await brand.deleteOne();
    
    await deleteCache(`brand:${id}`);
    await deleteCache('brands:list:*');
    
    return true;
  }
  
  async getBrandProducts(brandId, page = 1, limit = 20) {
    const brand = await this.getBrandById(brandId);
    
    const filter = {
      brand: brand._id,
      isActive: true
    };
    
    const products = await Product.find(filter)
      .limit(limit * 1)
      .skip((page - 1) * limit);
    
    const total = await Product.countDocuments(filter);
    
    return {
      brand,
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

module.exports = new BrandService();