/**
 * JWT Utilities
 * Token generation and verification
 */

const jwt = require('jsonwebtoken');
const { v4: uuidv4 } = require('uuid');
const config = require('../config');
const logger = require('../utils/logger');

/**
 * Generate access token
 */
const generateAccessToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    email: user.email,
    role: user.role,
    jti: uuidv4() // Unique token ID
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.expiresIn
  });
};

/**
 * Generate refresh token
 */
const generateRefreshToken = (user) => {
  const payload = {
    id: user.id,
    username: user.username,
    jti: uuidv4() // Unique token ID
  };

  return jwt.sign(payload, config.jwt.secret, {
    expiresIn: config.jwt.refreshExpiresIn
  });
};

/**
 * Verify access token
 */
const verifyAccessToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid token');
    } else {
      throw error;
    }
  }
};

/**
 * Verify refresh token
 */
const verifyRefreshToken = (token) => {
  try {
    return jwt.verify(token, config.jwt.secret);
  } catch (error) {
    if (error.name === 'TokenExpiredError') {
      throw new Error('Refresh token expired');
    } else if (error.name === 'JsonWebTokenError') {
      throw new Error('Invalid refresh token');
    } else {
      throw error;
    }
  }
};

/**
 * Extract token from Authorization header
 */
const extractToken = (authHeader) => {
  if (!authHeader) {
    return null;
  }

  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  return parts[1];
};

/**
 * Get token expiration time
 */
const getTokenExpiration = (expiresIn) => {
  const now = new Date();
  
  // Parse expiresIn (e.g., '24h', '7d')
  const match = expiresIn.match(/^(\d+)([hdm])$/);
  if (!match) {
    throw new Error('Invalid expiresIn format');
  }

  const value = parseInt(match[1]);
  const unit = match[2];

  switch (unit) {
    case 'h':
      now.setHours(now.getHours() + value);
      break;
    case 'd':
      now.setDate(now.getDate() + value);
      break;
    case 'm':
      now.setMinutes(now.getMinutes() + value);
      break;
  }

  return now.toISOString();
};

module.exports = {
  generateAccessToken,
  generateRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  extractToken,
  getTokenExpiration
};
