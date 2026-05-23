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
  
  static error(res, message, statusCode = 500, details = null) {
    const response = {
      success: false,
      message,
      timestamp: new Date().toISOString()
    };
    
    if (details) response.details = details;
    
    return res.status(statusCode).json(response);
  }
}

module.exports = { ApiResponse };