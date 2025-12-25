/**
 * Request Logging Middleware
 * Logs all incoming requests and responses
 */

const logger = require('../utils/logger');

/**
 * Log request details
 */
const requestLogger = (req, res, next) => {
  const startTime = Date.now();
  
  // Log request
  logger.info('Incoming request', {
    method: req.method,
    path: req.path,
    query: req.query,
    user: req.user ? req.user.username : 'anonymous',
    ip: req.ip,
    userAgent: req.get('user-agent')
  });

  // Override res.json to log response
  const originalJson = res.json.bind(res);
  res.json = function(body) {
    const duration = Date.now() - startTime;
    
    // Log response
    logger.info('Response sent', {
      method: req.method,
      path: req.path,
      statusCode: res.statusCode,
      duration: `${duration}ms`,
      user: req.user ? req.user.username : 'anonymous'
    });
    
    return originalJson(body);
  };

  next();
};

/**
 * Skip logging for health check
 */
const skipHealthCheck = (req, res, next) => {
  if (req.path === '/health') {
    return next();
  }
  requestLogger(req, res, next);
};

module.exports = {
  requestLogger,
  skipHealthCheck
};
