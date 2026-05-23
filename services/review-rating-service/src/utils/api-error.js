class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.details = details;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { ApiError };