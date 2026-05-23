class ApiError extends Error {
  constructor(statusCode, message, isOperational = true, errors = null) {
    super(message);
    this.statusCode = statusCode;
    this.isOperational = isOperational;
    this.errors = errors;
    
    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = { ApiError };