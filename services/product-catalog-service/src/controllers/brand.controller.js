const BrandService = require('../services/brand.service');
const { ApiResponse } = require('../utils/api-response');

class BrandController {
  async createBrand(req, res, next) {
    try {
      const brand = await BrandService.createBrand(req.body);
      ApiResponse.success(res, {
        message: 'Brand created successfully',
        data: brand
      }, 201);
    } catch (error) {
      next(error);
    }
  }
  
  async getAllBrands(req, res, next) {
    try {
      const brands = await BrandService.getAllBrands(req.query);
      ApiResponse.success(res, { data: brands });
    } catch (error) {
      next(error);
    }
  }
  
  async getBrandById(req, res, next) {
    try {
      const brand = await BrandService.getBrandById(req.params.id);
      ApiResponse.success(res, { data: brand });
    } catch (error) {
      next(error);
    }
  }
  
  async getBrandBySlug(req, res, next) {
    try {
      const brand = await BrandService.getBrandBySlug(req.params.slug);
      ApiResponse.success(res, { data: brand });
    } catch (error) {
      next(error);
    }
  }
  
  async updateBrand(req, res, next) {
    try {
      const brand = await BrandService.updateBrand(req.params.id, req.body);
      ApiResponse.success(res, {
        message: 'Brand updated successfully',
        data: brand
      });
    } catch (error) {
      next(error);
    }
  }
  
  async deleteBrand(req, res, next) {
    try {
      await BrandService.deleteBrand(req.params.id);
      ApiResponse.success(res, { message: 'Brand deleted successfully' });
    } catch (error) {
      next(error);
    }
  }
  
  async getBrandProducts(req, res, next) {
    try {
      const { id } = req.params;
      const { page, limit } = req.query;
      const result = await BrandService.getBrandProducts(id, page, limit);
      ApiResponse.success(res, result);
    } catch (error) {
      next(error);
    }
  }
}

module.exports = new BrandController();