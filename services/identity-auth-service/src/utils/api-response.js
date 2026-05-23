class ApiResponse {
  static success(res, { message, data = null, meta = null }, statusCode = 200) {
    const response = {
      success: true,
      message: message || 'Operation successful',
      timestamp: new Date().toISOString()
    };
    
    if (data) response.data = data;
    if (meta) response.meta = meta;
    
    return res.status(statusCode).json(response);
  }
  
  static error(res, message, statusCode = 500, errors = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (errors) response.errors = errors;
    
    return res.status(statusCode).json(response);
  }
  
  static paginated(res, data, page, limit, total, message = 'Success') {
    const totalPages = Math.ceil(total / limit);
    
    return this.success(res, {
      message,
      data,
      meta: {
        pagination: {
          page: parseInt(page),
          limit: parseInt(limit),
          total,
          totalPages,
          hasNext: page < totalPages,
          hasPrev: page > 1
        }
      }
    });
  }
}

module.exports = { ApiResponse };