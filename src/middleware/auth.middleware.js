/**
 * Authentication Middleware
 * JWT authentication and role-based access control
 */

const { verifyAccessToken, extractToken } = require('../utils/jwt');
const UserModel = require('../database/models/user.model');
const logger = require('../utils/logger');

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
    
    // Get user from database
    const user = await UserModel.findById(decoded.id);
    
    if (!user) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User not found'
      });
    }

    if (!user.is_active) {
      return res.status(401).json({
        error: 'Authentication failed',
        message: 'User account is inactive'
      });
    }

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
  return (req, res, next) => {
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

      return res.status(403).json({
        error: 'Access denied',
        message: `This action requires one of the following roles: ${allowedRoles.join(', ')}`
      });
    }

    next();
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
    const user = await UserModel.findById(decoded.id);
    
    if (user && user.is_active) {
      req.user = user;
    }
    
    next();
  } catch (error) {
    // Token invalid, but optional auth doesn't fail
    logger.debug('Optional authentication failed (continuing):', { error: error.message });
    next();
  }
};

module.exports = {
  authenticate,
  authorize,
  optionalAuthenticate
};
