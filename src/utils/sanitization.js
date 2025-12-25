/**
 * Input Sanitization Utilities
 * Prevent XSS, SQL injection, and other injection attacks
 */

/**
 * Sanitize HTML - escape HTML special characters
 */
const sanitizeHtml = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#x27;')
    .replace(/\//g, '&#x2F;');
};

/**
 * Sanitize for CSV/Excel - prevent formula injection
 */
const sanitizeCsv = (input) => {
  if (typeof input !== 'string') return input;
  
  // Check if starts with potentially dangerous characters
  const dangerousChars = ['=', '+', '-', '@', '\t', '\r'];
  const firstChar = input.charAt(0);
  
  if (dangerousChars.includes(firstChar)) {
    return "'" + input; // Prefix with single quote to prevent formula execution
  }
  
  return input;
};

/**
 * Sanitize SQL - basic check (we use parameterized queries but this is extra safety)
 */
const sanitizeSql = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove SQL comment markers
  return input
    .replace(/--/g, '')
    .replace(/\/\*/g, '')
    .replace(/\*\//g, '')
    .replace(/;/g, '');
};

/**
 * Sanitize NoSQL injection attempts
 */
const sanitizeNoSql = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove MongoDB operators
  return input.replace(/\$/g, '');
};

/**
 * Sanitize command injection attempts
 */
const sanitizeCommand = (input) => {
  if (typeof input !== 'string') return input;
  
  // Remove shell metacharacters
  const dangerous = ['|', '&', ';', '$', '`', '\n', '\r', '(', ')', '<', '>'];
  let sanitized = input;
  
  dangerous.forEach(char => {
    sanitized = sanitized.replace(new RegExp('\\' + char, 'g'), '');
  });
  
  return sanitized;
};

/**
 * Sanitize LDAP injection attempts
 */
const sanitizeLdap = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/\*/g, '\\2a')
    .replace(/\(/g, '\\28')
    .replace(/\)/g, '\\29')
    .replace(/\\/g, '\\5c')
    .replace(/\0/g, '\\00')
    .replace(/\//g, '\\2f');
};

/**
 * Validate safe characters only (alphanumeric + basic punctuation)
 */
const containsOnlySafeChars = (input, allowedPattern = /^[a-zA-Z0-9\s\-_.@]+$/) => {
  if (typeof input !== 'string') return false;
  return allowedPattern.test(input);
};

/**
 * Sanitize URL
 */
const sanitizeUrl = (input) => {
  if (typeof input !== 'string') return input;
  
  // Only allow http and https protocols
  try {
    const url = new URL(input);
    if (!['http:', 'https:'].includes(url.protocol)) {
      logger.warn('Invalid URL protocol attempted:', { protocol: url.protocol });
      return '';
    }
    return url.toString();
  } catch (error) {
    logger.warn('Invalid URL format:', { input: input.substring(0, 50) });
    return '';
  }
};

/**
 * Sanitize file path - prevent directory traversal
 */
const sanitizeFilePath = (input) => {
  if (typeof input !== 'string') return input;
  
  return input
    .replace(/\.\./g, '')
    .replace(/\\/g, '/')
    .replace(/\/\//g, '/');
};

/**
 * Prevent ReDoS by checking for dangerous regex patterns
 */
const isSafeRegex = (pattern) => {
  // Check for nested quantifiers which can cause ReDoS
  const dangerousPatterns = [
    /(\+\+|\*\*|\+\*|\*\+)/,  // Nested quantifiers
    /(\+|\*){2,}/,             // Multiple quantifiers in a row
    /\([^)]*(\+|\*)[^)]*\)(\+|\*)/ // Quantified groups with quantifiers inside
  ];
  
  return !dangerousPatterns.some(dp => dp.test(pattern));
};

/**
 * Comprehensive sanitization for general input
 */
const sanitizeInput = (input) => {
  if (typeof input !== 'string') return input;
  
  // Trim whitespace
  let sanitized = input.trim();
  
  // Apply basic sanitizations
  sanitized = sanitizeHtml(sanitized);
  sanitized = sanitizeCommand(sanitized);
  
  return sanitized;
};

module.exports = {
  sanitizeHtml,
  sanitizeCsv,
  sanitizeSql,
  sanitizeNoSql,
  sanitizeCommand,
  sanitizeLdap,
  containsOnlySafeChars,
  sanitizeUrl,
  sanitizeFilePath,
  isSafeRegex,
  sanitizeInput
};
