const crypto = require('crypto');

/**
 * Request logging middleware for Prokip Connector Plugin
 */

function requestLogger(req, res, next) {
  // Generate unique request ID
  req.requestId = crypto.randomUUID();
  
  const startTime = Date.now();
  const timestamp = new Date().toISOString();
  
  // Log request
  console.log(`📥 [${req.requestId}] ${req.method} ${req.url}`, {
    ip: req.ip,
    userAgent: req.get('User-Agent'),
    timestamp,
    headers: sanitizeHeaders(req.headers)
  });
  
  // Log request body for POST/PUT requests (sanitized)
  if (['POST', 'PUT', 'PATCH'].includes(req.method) && req.body) {
    console.log(`📋 [${req.requestId}] Request body:`, sanitizeRequestBody(req.body));
  }
  
  // Override res.end to log response
  const originalEnd = res.end;
  res.end = function(chunk, encoding) {
    const duration = Date.now() - startTime;
    const statusCode = res.statusCode;
    
    // Log response
    console.log(`📤 [${req.requestId}] ${req.method} ${req.url} ${statusCode}`, {
      duration: `${duration}ms`,
      contentLength: res.get('Content-Length'),
      timestamp: new Date().toISOString()
    });
    
    // Log response body for errors (sanitized)
    if (statusCode >= 400 && chunk) {
      try {
        const responseBody = chunk.toString();
        if (responseBody.startsWith('{')) {
          console.log(`❌ [${req.requestId}] Response body:`, sanitizeResponseBody(JSON.parse(responseBody)));
        }
      } catch (e) {
        // Ignore JSON parsing errors
      }
    }
    
    // Call original end
    originalEnd.call(this, chunk, encoding);
  };
  
  next();
}

/**
 * Sanitize headers to remove sensitive information
 */
function sanitizeHeaders(headers) {
  const sanitized = { ...headers };
  const sensitiveHeaders = ['authorization', 'cookie', 'x-api-key', 'x-auth-token'];
  
  sensitiveHeaders.forEach(header => {
    if (sanitized[header]) {
      sanitized[header] = '***REDACTED***';
    }
  });
  
  return sanitized;
}

/**
 * Sanitize request body to remove sensitive information
 */
function sanitizeRequestBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  const sensitiveFields = ['password', 'api_secret', 'access_token', 'secret', 'token', 'key'];
  
  function sanitizeObject(obj) {
    if (Array.isArray(obj)) {
      return obj.map(sanitizeObject);
    }
    
    if (obj && typeof obj === 'object') {
      const result = {};
      for (const [key, value] of Object.entries(obj)) {
        const lowerKey = key.toLowerCase();
        const isSensitive = sensitiveFields.some(field => lowerKey.includes(field));
        
        if (isSensitive) {
          result[key] = '***REDACTED***';
        } else if (typeof value === 'object') {
          result[key] = sanitizeObject(value);
        } else {
          result[key] = value;
        }
      }
      return result;
    }
    
    return obj;
  }
  
  return sanitizeObject(sanitized);
}

/**
 * Sanitize response body to remove sensitive information
 */
function sanitizeResponseBody(body) {
  if (!body || typeof body !== 'object') {
    return body;
  }
  
  const sanitized = { ...body };
  
  // Remove stack traces in production
  if (process.env.NODE_ENV !== 'development' && sanitized.stack) {
    delete sanitized.stack;
  }
  
  return sanitized;
}

module.exports = requestLogger;
