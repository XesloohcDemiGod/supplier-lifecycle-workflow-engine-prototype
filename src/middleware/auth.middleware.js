/**
 * Authentication Middleware
 * JWT authentication and role-based access control
 */

const { verifyAccessToken, extractToken } = require('../utils/jwt');
const UserModel = require('../database/models/user.model');
const logger = require('../utils/logger');
const { logSecurityEvent, SEVERITY, EVENT_TYPES, checkGeographicAnomaly } = require('../utils/security-logger');
const db = require('../database/connection');
const config = require('../config');

/**
 * Check if token is blacklisted
 */
const isTokenBlacklisted = async (jti) => {
  try {
    const result = await db.get(
      'SELECT * FROM token_blacklist WHERE jti = ? AND expires_at > ?',
      [jti, new Date().toISOString()]
    );
    return !!result;
  } catch (error) {
    logger.error('Error checking token blacklist:', error);
    return false;
  }
};

/**
 * Check session timeout
 */
const isSessionExpired = (lastActivity) => {
  if (!lastActivity) return false;
  
  const lastActivityTime = new Date(lastActivity).getTime();
  const now = Date.now();
  const timeoutMs = config.session.timeoutMs;
  
  return (now - lastActivityTime) > timeoutMs;
};

/**
 * Authenticate JWT token
 */
const authenticate = async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (!token) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'No token provided'
      });
    }

    // Verify token
    const decoded = verifyAccessToken(token);
    
    // Check if token is blacklisted
    if (decoded.jti && await isTokenBlacklisted(decoded.jti)) {
      await logSecurityEvent(
        EVENT_TYPES.TOKEN_INVALID,
        SEVERITY.MEDIUM,
        {
          userId: decoded.id,
          username: decoded.username,
          ipAddress: req.ip,
          reason: 'Token blacklisted'
        }
      );
      
      return res.status(401).json({
        error: 'Token invalid',
        message: 'This token has been revoked'
      });
    }
    
    // Get user from database
    const user = await UserModel.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      await logSecurityEvent(
        EVENT_TYPES.UNAUTHORIZED_ACCESS,
        SEVERITY.MEDIUM,
        {
          userId: user.id,
          username: user.username,
          ipAddress: req.ip,
          reason: 'Inactive account'
        }
      );
      
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User account is inactive'
      });
    }

    // Check if account is locked
    if (user.locked_until) {
      const lockedUntil = new Date(user.locked_until);
      if (lockedUntil > new Date()) {
        await logSecurityEvent(
          EVENT_TYPES.UNAUTHORIZED_ACCESS,
          SEVERITY.MEDIUM,
          {
            userId: user.id,
            username: user.username,
            ipAddress: req.ip,
            reason: 'Account locked',
            lockedUntil: user.locked_until
          }
        );
        
        return res.status(401).json({
          error: 'Account locked',
          message: `Account is locked until ${lockedUntil.toISOString()}`,
          lockedUntil: lockedUntil.toISOString()
        });
      } else {
        // Unlock account if lock period expired
        await UserModel.unlockAccount(user.id);
        user.locked_until = null;
        user.failed_login_attempts = 0;
      }
    }

    // Check session timeout
    if (user.last_login && isSessionExpired(user.last_login)) {
      await logSecurityEvent(
        EVENT_TYPES.TOKEN_EXPIRED,
        SEVERITY.LOW,
        {
          userId: user.id,
          username: user.username,
          ipAddress: req.ip,
          reason: 'Session timeout'
        }
      );
      
      return res.status(401).json({
        error: 'Session expired',
        message: 'Your session has expired due to inactivity. Please login again.'
      });
    }

    // Check for geographic anomaly
    if (user.last_login_ip && user.last_login_ip !== req.ip) {
      await checkGeographicAnomaly(user.id, req.ip, user.last_login_ip);
    }

    // Update last activity (for session timeout tracking)
    await UserModel.updateLastActivity(user.id, req.ip);

    // Attach user to request
    req.user = user;
    next();
  } catch (error) {
    logger.warn('Authentication error:', { error: error.message, path: req.path });
    
    if (error.message === 'Token expired') {
      return res.status(401).json({
        error: 'Token expired',
        message: 'Please refresh your token or login again'
      });
    }

    return res.status(401).json({
      error: 'Authentication failed',
      message: error.message
    });
  }
};

/**
 * Check if user has required role(s)
 */
const authorize = (...allowedRoles) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    const userRole = req.user.role;
    
    // Admin has access to everything
    if (userRole === 'Admin') {
      return next();
    }

    if (!allowedRoles.includes(userRole)) {
      logger.warn('Authorization failed:', {
        user: req.user.username,
        role: userRole,
        requiredRoles: allowedRoles,
        path: req.path
      });

      await logSecurityEvent(
        EVENT_TYPES.PERMISSION_DENIED,
        SEVERITY.MEDIUM,
        {
          userId: req.user.id,
          username: req.user.username,
          ipAddress: req.ip,
          role: userRole,
          requiredRoles: allowedRoles,
          path: req.path
        }
      ).catch(err => logger.error('Failed to log permission denied:', err));

      return res.status(403).json({
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
  };
};

/**
 * Check resource ownership (buyer can only access their own resources)
 */
const checkOwnership = (resourceType) => {
  return async (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required'
      });
    }

    // Admin can access everything
    if (req.user.role === 'Admin') {
      return next();
    }

    try {
      const resourceId = req.params.id || req.params.supplierId;
      
      if (resourceType === 'supplier') {
        // Buyer can only access suppliers they requested
        // Supplier can only access their own profile (email match)
        const supplier = await db.get('SELECT * FROM suppliers WHERE id = ?', [resourceId]);
        
        if (!supplier) {
          return res.status(404).json({
            error: 'Not found',
            message: 'Supplier not found'
          });
        }

        if (req.user.role === 'Buyer' && supplier.requested_by !== req.user.username) {
          await logSecurityEvent(
            EVENT_TYPES.UNAUTHORIZED_ACCESS,
            SEVERITY.MEDIUM,
            {
              userId: req.user.id,
              username: req.user.username,
              ipAddress: req.ip,
              resourceType,
              resourceId,
              reason: 'Not resource owner'
            }
          );
          
          return res.status(403).json({
            error: 'Access denied',
            message: 'You can only access suppliers you requested'
          });
        }

        if (req.user.role === 'Supplier' && supplier.contact_email !== req.user.email) {
          await logSecurityEvent(
            EVENT_TYPES.UNAUTHORIZED_ACCESS,
            SEVERITY.MEDIUM,
            {
              userId: req.user.id,
              username: req.user.username,
              ipAddress: req.ip,
              resourceType,
              resourceId,
              reason: 'Not resource owner'
            }
          );
          
          return res.status(403).json({
            error: 'Access denied',
            message: 'You can only access your own supplier profile'
          });
        }
      }

      next();
    } catch (error) {
      logger.error('Ownership check error:', error);
      return res.status(500).json({
        error: 'Internal server error',
        message: 'Failed to verify resource ownership'
      });
    }
  };
};

/**
 * Optional authentication (doesn't fail if no token)
 */
const optionalAuthenticate = async (req, res, next) => {
  try {
    const token = extractToken(req.headers.authorization);
    
    if (!token) {
      // No token, but that's ok for optional auth
      return next();
    }

    const decoded = verifyAccessToken(token);
    
    // Check if token is blacklisted
    if (decoded.jti && await isTokenBlacklisted(decoded.jti)) {
      return next();
    }
    
    const user = await UserModel.findById(decoded.id);
    
    if (user && user.is_active && !user.locked_until) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Token invalid, but optional auth doesn't fail
    logger.debug('Optional authentication failed (continuing):', { error: error.message });
    next();
  }
};

/**
 * Prevent role escalation
 */
const preventRoleEscalation = async (req, res, next) => {
  if (!req.user) {
    return res.status(401).json({
      error: 'Authentication required'
    });
  }

  // Check if trying to change role in request body
  if (req.body.role) {
    const requestedRole = req.body.role;
    const userRole = req.user.role;

    // Only admins can assign roles
    if (userRole !== 'Admin') {
      await logSecurityEvent(
        EVENT_TYPES.UNAUTHORIZED_ACCESS,
        SEVERITY.HIGH,
        {
          userId: req.user.id,
          username: req.user.username,
          ipAddress: req.ip,
          attemptedRole: requestedRole,
          currentRole: userRole,
          reason: 'Role escalation attempt'
        }
      ).catch(err => logger.error('Failed to log role escalation:', err));

      return res.status(403).json({
        error: 'Access denied',
        message: 'Only administrators can assign roles'
      });
    }
  }

  next();
};

module.exports = {
  authenticate,
  authorize,
  checkOwnership,
  optionalAuthenticate,
  preventRoleEscalation,
  isTokenBlacklisted
};
