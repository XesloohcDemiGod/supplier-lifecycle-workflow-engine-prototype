/**
 * Security Event Logger
 * Track and log security-relevant events
 */

const db = require('../database/connection');
const logger = require('./logger');
const { maskEmail, maskIp } = require('./encryption');

const SEVERITY = {
  LOW: 'LOW',
  MEDIUM: 'MEDIUM',
  HIGH: 'HIGH',
  CRITICAL: 'CRITICAL'
};

const EVENT_TYPES = {
  LOGIN_SUCCESS: 'LOGIN_SUCCESS',
  LOGIN_FAILED: 'LOGIN_FAILED',
  LOGIN_LOCKED: 'LOGIN_LOCKED',
  LOGOUT: 'LOGOUT',
  TOKEN_REFRESH: 'TOKEN_REFRESH',
  TOKEN_EXPIRED: 'TOKEN_EXPIRED',
  TOKEN_INVALID: 'TOKEN_INVALID',
  ACCOUNT_CREATED: 'ACCOUNT_CREATED',
  ACCOUNT_LOCKED: 'ACCOUNT_LOCKED',
  ACCOUNT_SUSPENDED: 'ACCOUNT_SUSPENDED',
  PASSWORD_CHANGED: 'PASSWORD_CHANGED',
  RATE_LIMIT_EXCEEDED: 'RATE_LIMIT_EXCEEDED',
  INVALID_INPUT: 'INVALID_INPUT',
  UNAUTHORIZED_ACCESS: 'UNAUTHORIZED_ACCESS',
  PERMISSION_DENIED: 'PERMISSION_DENIED',
  SUSPICIOUS_ACTIVITY: 'SUSPICIOUS_ACTIVITY',
  DATA_BREACH_ATTEMPT: 'DATA_BREACH_ATTEMPT',
  SQL_INJECTION_ATTEMPT: 'SQL_INJECTION_ATTEMPT',
  XSS_ATTEMPT: 'XSS_ATTEMPT',
  CSRF_ATTEMPT: 'CSRF_ATTEMPT',
  GEOGRAPHIC_ANOMALY: 'GEOGRAPHIC_ANOMALY',
  RAPID_REQUESTS: 'RAPID_REQUESTS',
  ACCOUNT_CREATION_ABUSE: 'ACCOUNT_CREATION_ABUSE',
  STATE_TRANSITION_VIOLATION: 'STATE_TRANSITION_VIOLATION',
  CONCURRENT_MODIFICATION: 'CONCURRENT_MODIFICATION'
};

/**
 * Log security event
 */
const logSecurityEvent = async (eventType, severity, details = {}) => {
  const timestamp = new Date().toISOString();
  
  try {
    // Log to database
    await db.run(
      `INSERT INTO security_events (event_type, user_id, username, ip_address, user_agent, details, severity, timestamp)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
      [
        eventType,
        details.userId || null,
        details.username || null,
        details.ipAddress || null,
        details.userAgent || null,
        JSON.stringify(details),
        severity,
        timestamp
      ]
    );
    
    // Log to winston logger based on severity
    const logMethod = severity === SEVERITY.CRITICAL ? 'error' : 
                      severity === SEVERITY.HIGH ? 'warn' : 'info';
    
    logger[logMethod]('Security Event', {
      eventType,
      severity,
      username: details.username ? maskEmail(details.username) : undefined,
      ipAddress: details.ipAddress ? maskIp(details.ipAddress) : undefined,
      timestamp
    });
    
    // Alert on critical events
    if (severity === SEVERITY.CRITICAL) {
      await alertCriticalEvent(eventType, details);
    }
  } catch (error) {
    logger.error('Failed to log security event:', error);
  }
};

/**
 * Alert on critical security events
 */
const alertCriticalEvent = async (eventType, details) => {
  // In production, this would send alerts to monitoring systems (PagerDuty, Slack, etc.)
  logger.error('CRITICAL SECURITY ALERT', {
    eventType,
    details: {
      ...details,
      ipAddress: details.ipAddress ? maskIp(details.ipAddress) : undefined
    }
  });
};

/**
 * Log login attempt
 */
const logLoginAttempt = async (username, ipAddress, success, userAgent = null) => {
  try {
    await db.run(
      `INSERT INTO login_attempts (username, ip_address, success, timestamp, user_agent)
       VALUES (?, ?, ?, ?, ?)`,
      [username, ipAddress, success ? 1 : 0, new Date().toISOString(), userAgent]
    );
    
    if (!success) {
      await logSecurityEvent(
        EVENT_TYPES.LOGIN_FAILED,
        SEVERITY.MEDIUM,
        { username, ipAddress, userAgent }
      );
    }
  } catch (error) {
    logger.error('Failed to log login attempt:', error);
  }
};

/**
 * Log account creation
 */
const logAccountCreation = async (ipAddress, email) => {
  try {
    await db.run(
      `INSERT INTO account_creation_tracking (ip_address, email, timestamp)
       VALUES (?, ?, ?)`,
      [ipAddress, email, new Date().toISOString()]
    );
  } catch (error) {
    logger.error('Failed to log account creation:', error);
  }
};

/**
 * Get recent security events
 */
const getRecentSecurityEvents = async (limit = 100, severity = null) => {
  try {
    let query = 'SELECT * FROM security_events';
    const params = [];
    
    if (severity) {
      query += ' WHERE severity = ?';
      params.push(severity);
    }
    
    query += ' ORDER BY timestamp DESC LIMIT ?';
    params.push(limit);
    
    return await db.all(query, params);
  } catch (error) {
    logger.error('Failed to get security events:', error);
    return [];
  }
};

/**
 * Get failed login attempts for user
 */
const getFailedLoginAttempts = async (username, windowMinutes = 15) => {
  try {
    const cutoffTime = new Date(Date.now() - windowMinutes * 60 * 1000).toISOString();
    
    const result = await db.get(
      `SELECT COUNT(*) as count 
       FROM login_attempts 
       WHERE username = ? AND success = 0 AND timestamp > ?`,
      [username, cutoffTime]
    );
    
    return result ? result.count : 0;
  } catch (error) {
    logger.error('Failed to get failed login attempts:', error);
    return 0;
  }
};

/**
 * Get account creation attempts from IP
 */
const getAccountCreationAttempts = async (ipAddress, windowHours = 1) => {
  try {
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
    
    const result = await db.get(
      `SELECT COUNT(*) as count 
       FROM account_creation_tracking 
       WHERE ip_address = ? AND timestamp > ?`,
      [ipAddress, cutoffTime]
    );
    
    return result ? result.count : 0;
  } catch (error) {
    logger.error('Failed to get account creation attempts:', error);
    return 0;
  }
};

/**
 * Check for geographic anomaly
 */
const checkGeographicAnomaly = async (userId, currentIp, previousIp) => {
  // In production, this would use a GeoIP service to check if IPs are from different countries
  // For now, just check if IPs are significantly different
  if (previousIp && currentIp !== previousIp) {
    const prevParts = previousIp.split('.');
    const currParts = currentIp.split('.');
    
    // If first two octets are different, might be different region
    if (prevParts[0] !== currParts[0] || prevParts[1] !== currParts[1]) {
      await logSecurityEvent(
        EVENT_TYPES.GEOGRAPHIC_ANOMALY,
        SEVERITY.MEDIUM,
        { userId, currentIp, previousIp }
      );
      return true;
    }
  }
  
  return false;
};

/**
 * Get security metrics
 */
const getSecurityMetrics = async (windowHours = 24) => {
  try {
    const cutoffTime = new Date(Date.now() - windowHours * 60 * 60 * 1000).toISOString();
    
    const metrics = {
      totalEvents: 0,
      criticalEvents: 0,
      highEvents: 0,
      failedLogins: 0,
      rateLimitExceeded: 0,
      unauthorizedAccess: 0,
      suspiciousActivity: 0
    };
    
    // Get total events
    const totalResult = await db.get(
      'SELECT COUNT(*) as count FROM security_events WHERE timestamp > ?',
      [cutoffTime]
    );
    metrics.totalEvents = totalResult ? totalResult.count : 0;
    
    // Get critical events
    const criticalResult = await db.get(
      'SELECT COUNT(*) as count FROM security_events WHERE severity = ? AND timestamp > ?',
      [SEVERITY.CRITICAL, cutoffTime]
    );
    metrics.criticalEvents = criticalResult ? criticalResult.count : 0;
    
    // Get high severity events
    const highResult = await db.get(
      'SELECT COUNT(*) as count FROM security_events WHERE severity = ? AND timestamp > ?',
      [SEVERITY.HIGH, cutoffTime]
    );
    metrics.highEvents = highResult ? highResult.count : 0;
    
    // Get failed logins
    const failedLoginsResult = await db.get(
      'SELECT COUNT(*) as count FROM login_attempts WHERE success = 0 AND timestamp > ?',
      [cutoffTime]
    );
    metrics.failedLogins = failedLoginsResult ? failedLoginsResult.count : 0;
    
    // Get rate limit violations
    const rateLimitResult = await db.get(
      'SELECT COUNT(*) as count FROM security_events WHERE event_type = ? AND timestamp > ?',
      [EVENT_TYPES.RATE_LIMIT_EXCEEDED, cutoffTime]
    );
    metrics.rateLimitExceeded = rateLimitResult ? rateLimitResult.count : 0;
    
    // Get unauthorized access attempts
    const unauthorizedResult = await db.get(
      'SELECT COUNT(*) as count FROM security_events WHERE event_type = ? AND timestamp > ?',
      [EVENT_TYPES.UNAUTHORIZED_ACCESS, cutoffTime]
    );
    metrics.unauthorizedAccess = unauthorizedResult ? unauthorizedResult.count : 0;
    
    // Get suspicious activity
    const suspiciousResult = await db.get(
      'SELECT COUNT(*) as count FROM security_events WHERE event_type = ? AND timestamp > ?',
      [EVENT_TYPES.SUSPICIOUS_ACTIVITY, cutoffTime]
    );
    metrics.suspiciousActivity = suspiciousResult ? suspiciousResult.count : 0;
    
    return metrics;
  } catch (error) {
    logger.error('Failed to get security metrics:', error);
    return null;
  }
};

module.exports = {
  SEVERITY,
  EVENT_TYPES,
  logSecurityEvent,
  logLoginAttempt,
  logAccountCreation,
  getRecentSecurityEvents,
  getFailedLoginAttempts,
  getAccountCreationAttempts,
  checkGeographicAnomaly,
  getSecurityMetrics
};
