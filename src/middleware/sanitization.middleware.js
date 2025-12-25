/**
 * Sanitization Middleware
 * Sanitize incoming requests to prevent injection attacks
 */

const { sanitizeInput, sanitizeHtml, sanitizeCommand } = require('../utils/sanitization');
const { logSecurityEvent, SEVERITY, EVENT_TYPES } = require('../utils/security-logger');
const logger = require('../utils/logger');

/**
 * Detect potential SQL injection patterns
 */
const detectSqlInjection = (input) => {
  if (typeof input !== 'string') return false;
  
  const sqlPatterns = [
    /(\bUNION\b|\bSELECT\b|\bINSERT\b|\bUPDATE\b|\bDELETE\b|\bDROP\b|\bCREATE\b|\bALTER\b)/i,
    /('|"|`)\s*(OR|AND)\s*('|"|`)?/i,
    /1\s*=\s*1/,
    /'\s*OR\s*'1'\s*=\s*'1/i,
    /--/,
    /\/\*/,
    /xp_/i
  ];
  
  return sqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Detect potential XSS patterns
 */
const detectXss = (input) => {
  if (typeof input !== 'string') return false;
  
  const xssPatterns = [
    /<script\b[^<]*(?:(?!<\/script>)<[^<]*)*<\/script>/gi,
    /javascript:/gi,
    /on\w+\s*=/gi, // onclick, onload, etc.
    /<iframe/gi,
    /<embed/gi,
    /<object/gi,
    /eval\(/gi,
    /expression\(/gi
  ];
  
  return xssPatterns.some(pattern => pattern.test(input));
};

/**
 * Detect potential NoSQL injection patterns
 */
const detectNoSqlInjection = (input) => {
  if (typeof input !== 'string') return false;
  
  const noSqlPatterns = [
    /\$where/i,
    /\$ne/i,
    /\$gt/i,
    /\$lt/i,
    /\$regex/i,
    /\$exists/i
  ];
  
  return noSqlPatterns.some(pattern => pattern.test(input));
};

/**
 * Detect potential command injection patterns
 */
const detectCommandInjection = (input) => {
  if (typeof input !== 'string') return false;
  
  const commandPatterns = [
    /[|&;`$\n]/,
    /\$\(/,
    /\)\s*{/,
    /bash/i,
    /sh\s+-c/i
  ];
  
  return commandPatterns.some(pattern => pattern.test(input));
};

/**
 * Detect potential LDAP injection patterns
 */
const detectLdapInjection = (input) => {
  if (typeof input !== 'string') return false;
  
  const ldapPatterns = [
    /\*/,
    /\(.*\)/,
    /[()\\]/
  ];
  
  return ldapPatterns.some(pattern => pattern.test(input));
};

/**
 * Recursively sanitize object
 */
const sanitizeObject = (obj, path = '') => {
  if (obj === null || obj === undefined) {
    return obj;
  }

  if (Array.isArray(obj)) {
    return obj.map((item, index) => sanitizeObject(item, `${path}[${index}]`));
  }

  if (typeof obj === 'object') {
    const sanitized = {};
    for (const [key, value] of Object.entries(obj)) {
      sanitized[key] = sanitizeObject(value, path ? `${path}.${key}` : key);
    }
    return sanitized;
  }

  if (typeof obj === 'string') {
    return sanitizeInput(obj);
  }

  return obj;
};

/**
 * Detect and log injection attempts
 */
const detectInjectionAttempts = async (data, req) => {
  const checkValue = async (value, key, type) => {
    if (typeof value !== 'string') return;
    
    let detected = false;
    let detectionType = '';

    if (detectSqlInjection(value)) {
      detected = true;
      detectionType = 'SQL_INJECTION';
    } else if (detectXss(value)) {
      detected = true;
      detectionType = 'XSS';
    } else if (detectNoSqlInjection(value)) {
      detected = true;
      detectionType = 'NOSQL_INJECTION';
    } else if (detectCommandInjection(value)) {
      detected = true;
      detectionType = 'COMMAND_INJECTION';
    } else if (detectLdapInjection(value)) {
      detected = true;
      detectionType = 'LDAP_INJECTION';
    }

    if (detected) {
      await logSecurityEvent(
        EVENT_TYPES[`${detectionType}_ATTEMPT`] || EVENT_TYPES.SUSPICIOUS_ACTIVITY,
        SEVERITY.HIGH,
        {
          userId: req.user?.id,
          username: req.user?.username,
          ipAddress: req.ip,
          path: req.path,
          method: req.method,
          field: key,
          detectionType,
          userAgent: req.get('user-agent')
        }
      );

      logger.warn(`${detectionType} attempt detected`, {
        field: key,
        path: req.path,
        ip: req.ip
      });
    }
  };

  const traverse = async (obj, prefix = '') => {
    if (obj === null || obj === undefined) return;

    if (Array.isArray(obj)) {
      for (let i = 0; i < obj.length; i++) {
        await traverse(obj[i], `${prefix}[${i}]`);
      }
    } else if (typeof obj === 'object') {
      for (const [key, value] of Object.entries(obj)) {
        const fullKey = prefix ? `${prefix}.${key}` : key;
        await checkValue(value, fullKey, 'object');
        await traverse(value, fullKey);
      }
    } else if (typeof obj === 'string') {
      await checkValue(obj, prefix, 'string');
    }
  };

  await traverse(data);
};

/**
 * Sanitization middleware
 */
const sanitizationMiddleware = async (req, res, next) => {
  try {
    // Detect injection attempts before sanitizing
    if (req.body && Object.keys(req.body).length > 0) {
      await detectInjectionAttempts(req.body, req);
    }

    // Sanitize request body
    if (req.body && Object.keys(req.body).length > 0) {
      req.body = sanitizeObject(req.body);
    }

    // Sanitize query parameters
    if (req.query && Object.keys(req.query).length > 0) {
      await detectInjectionAttempts(req.query, req);
      req.query = sanitizeObject(req.query);
    }

    // Sanitize URL parameters
    if (req.params && Object.keys(req.params).length > 0) {
      await detectInjectionAttempts(req.params, req);
      req.params = sanitizeObject(req.params);
    }

    next();
  } catch (error) {
    logger.error('Sanitization middleware error:', error);
    // Fail safe - continue even if sanitization fails
    next();
  }
};

/**
 * Strict sanitization middleware (blocks suspicious requests)
 */
const strictSanitizationMiddleware = async (req, res, next) => {
  try {
    // Check request body
    if (req.body && Object.keys(req.body).length > 0) {
      for (const [key, value] of Object.entries(req.body)) {
        if (typeof value === 'string') {
          if (detectSqlInjection(value) || detectXss(value) || 
              detectCommandInjection(value) || detectNoSqlInjection(value)) {
            
            await logSecurityEvent(
              EVENT_TYPES.INVALID_INPUT,
              SEVERITY.HIGH,
              {
                userId: req.user?.id,
                username: req.user?.username,
                ipAddress: req.ip,
                path: req.path,
                field: key
              }
            );

            return res.status(400).json({
              error: 'Invalid input',
              message: 'Your request contains potentially malicious content and has been blocked.',
              field: key
            });
          }
        }
      }
    }

    // Continue with normal sanitization
    await sanitizationMiddleware(req, res, next);
  } catch (error) {
    logger.error('Strict sanitization middleware error:', error);
    next();
  }
};

module.exports = {
  sanitizationMiddleware,
  strictSanitizationMiddleware,
  detectSqlInjection,
  detectXss,
  detectNoSqlInjection,
  detectCommandInjection,
  detectLdapInjection
};
