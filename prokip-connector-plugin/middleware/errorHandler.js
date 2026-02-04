/**
 * Error handling middleware for Prokip Connector Plugin
 */

function errorHandler(error, req, res, next) {
  console.error('❌ Error occurred:', {
    message: error.message,
    stack: error.stack,
    url: req.url,
    method: req.method,
    timestamp: new Date().toISOString()
  });
  
  // Don't expose stack trace in production
  const isDevelopment = process.env.NODE_ENV === 'development';
  
  // Default error response
  let statusCode = 500;
  let message = 'Internal server error';
  let details = {};
  
  // Handle specific error types
  if (error.name === 'ValidationError') {
    statusCode = 400;
    message = 'Validation error';
    details = error.details || {};
  } else if (error.name === 'AuthenticationError') {
    statusCode = 401;
    message = 'Authentication failed';
  } else if (error.name === 'AuthorizationError') {
    statusCode = 403;
    message = 'Access denied';
  } else if (error.name === 'NotFoundError') {
    statusCode = 404;
    message = 'Resource not found';
  } else if (error.name === 'ConflictError') {
    statusCode = 409;
    message = 'Resource conflict';
  } else if (error.name === 'RateLimitError') {
    statusCode = 429;
    message = 'Rate limit exceeded';
  } else if (error.name === 'ExternalServiceError') {
    statusCode = 502;
    message = 'External service error';
    details = { service: error.service || 'unknown' };
  } else if (error.message) {
    // Use the error message if it's safe
    if (error.message.includes('Authentication') || 
        error.message.includes('credentials') ||
        error.message.includes('permission') ||
        error.message.includes('not found') ||
        error.message.includes('invalid') ||
        error.message.includes('required')) {
      statusCode = 400;
      message = error.message;
    }
  }
  
  const response = {
    success: false,
    error: message,
    timestamp: new Date().toISOString()
  };
  
  // Add details in development or if explicitly allowed
  if (isDevelopment || Object.keys(details).length > 0) {
    response.details = details;
  }
  
  // Add stack trace in development
  if (isDevelopment && error.stack) {
    response.stack = error.stack;
  }
  
  // Add request ID if available
  if (req.requestId) {
    response.request_id = req.requestId;
  }
  
  res.status(statusCode).json(response);
}

module.exports = errorHandler;
