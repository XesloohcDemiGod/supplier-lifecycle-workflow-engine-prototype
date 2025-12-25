/**
 * Authentication Routes
 * Handles user registration, login, logout, token refresh
 */

const express = require('express');
const UserModel = require('../database/models/user.model');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, getTokenExpiration } = require('../utils/jwt');
const { validateBody } = require('../middleware/validation.middleware');
const { authSchemas } = require('../validators/schemas');
const { authenticate, preventRoleEscalation } = require('../middleware/auth.middleware');
const { asyncHandler, AuthenticationError, ConflictError } = require('../middleware/error.middleware');
const { registrationRateLimiter, authRateLimiter } = require('../middleware/rate-limit.middleware');
const { logSecurityEvent, logLoginAttempt, logAccountCreation, getAccountCreationAttempts, SEVERITY, EVENT_TYPES } = require('../utils/security-logger');
const logger = require('../utils/logger');
const config = require('../config');
const crypto = require('crypto');

const router = express.Router();

/**
 * Helper to get client IP
 */
const getClientIp = (req) => {
  return req.ip || req.connection.remoteAddress;
};

/**
 * Helper to get user agent
 */
const getUserAgent = (req) => {
  return req.get('user-agent') || 'Unknown';
};

/**
 * POST /api/auth/register - Register new user
 */
router.post('/register', registrationRateLimiter, validateBody(authSchemas.register), asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;
  const ipAddress = getClientIp(req);

  // Check account creation rate from this IP
  const creationAttempts = await getAccountCreationAttempts(ipAddress, 1);
  
  if (creationAttempts >= config.fraudDetection.maxAccountCreationsPerHour) {
    await logSecurityEvent(
      EVENT_TYPES.ACCOUNT_CREATION_ABUSE,
      SEVERITY.HIGH,
      {
        ipAddress,
        email,
        username,
        attempts: creationAttempts
      }
    );

    return res.status(429).json({
      error: 'Too many account creation attempts',
      message: 'Maximum account creation limit reached from this IP address. Please try again later.'
    });
  }

  // Check if user already exists
  const existingUser = await UserModel.findByUsername(username);
  if (existingUser) {
    throw new ConflictError('Username already exists');
  }

  const existingEmail = await UserModel.findByEmail(email);
  if (existingEmail) {
    throw new ConflictError('Email already exists');
  }

  // Create user
  const user = await UserModel.create({ username, email, password, role });

  // Log account creation
  await logAccountCreation(ipAddress, email);
  await logSecurityEvent(
    EVENT_TYPES.ACCOUNT_CREATED,
    SEVERITY.LOW,
    {
      userId: user.id,
      username,
      email,
      role,
      ipAddress
    }
  );

  logger.info(`User registered: ${username} (${role})`);

  res.status(201).json({
    success: true,
    message: 'User registered successfully',
    user
  });
}));

/**
 * POST /api/auth/login - Login user
 */
router.post('/login', authRateLimiter, validateBody(authSchemas.login), asyncHandler(async (req, res) => {
  const { username, password } = req.body;
  const ipAddress = getClientIp(req);
  const userAgent = getUserAgent(req);

  // Find user
  const user = await UserModel.findByUsername(username);
  if (!user) {
    // Log failed attempt even if user doesn't exist (don't reveal which)
    await logLoginAttempt(username, ipAddress, false, userAgent);
    throw new AuthenticationError('Invalid username or password');
  }

  // Check if account is locked
  if (user.locked_until) {
    const lockedUntil = new Date(user.locked_until);
    if (lockedUntil > new Date()) {
      await logLoginAttempt(username, ipAddress, false, userAgent);
      await logSecurityEvent(
        EVENT_TYPES.LOGIN_LOCKED,
        SEVERITY.MEDIUM,
        {
          userId: user.id,
          username,
          ipAddress,
          lockedUntil: user.locked_until
        }
      );

      return res.status(401).json({
        error: 'Account locked',
        message: `Account is locked until ${lockedUntil.toISOString()} due to too many failed login attempts`,
        lockedUntil: lockedUntil.toISOString()
      });
    } else {
      // Unlock account if lock period expired
      await UserModel.unlockAccount(user.id);
    }
  }

  // Check if user is active
  if (!user.is_active) {
    await logLoginAttempt(username, ipAddress, false, userAgent);
    throw new AuthenticationError('User account is inactive');
  }

  // Verify password
  const isValid = await UserModel.verifyPassword(password, user.password_hash);
  if (!isValid) {
    // Increment failed login attempts
    const attempts = await UserModel.incrementFailedLoginAttempts(user.id);
    await logLoginAttempt(username, ipAddress, false, userAgent);

    const remainingAttempts = config.session.maxLoginAttempts - attempts;
    
    if (remainingAttempts <= 0) {
      await logSecurityEvent(
        EVENT_TYPES.ACCOUNT_LOCKED,
        SEVERITY.HIGH,
        {
          userId: user.id,
          username,
          ipAddress,
          failedAttempts: attempts
        }
      );

      return res.status(401).json({
        error: 'Account locked',
        message: 'Too many failed login attempts. Account has been locked.',
        lockedUntil: new Date(Date.now() + config.session.lockoutDurationMs).toISOString()
      });
    }

    return res.status(401).json({
      error: 'Invalid credentials',
      message: `Invalid username or password. ${remainingAttempts} attempts remaining.`,
      remainingAttempts
    });
  }

  // Successful login - reset failed attempts and update last login
  await UserModel.updateLastLogin(user.id, ipAddress);
  await logLoginAttempt(username, ipAddress, true, userAgent);
  await logSecurityEvent(
    EVENT_TYPES.LOGIN_SUCCESS,
    SEVERITY.LOW,
    {
      userId: user.id,
      username,
      ipAddress
    }
  );

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token
  const refreshExpiration = getTokenExpiration(config.jwt.refreshExpiresIn);
  await UserModel.saveRefreshToken(user.id, refreshToken, refreshExpiration, ipAddress, userAgent);

  // Remove password from response
  const sanitizedUser = UserModel.sanitizeUser(user);

  logger.info(`User logged in: ${username} from ${ipAddress}`);

  res.json({
    success: true,
    message: 'Login successful',
    user: sanitizedUser,
    accessToken,
    refreshToken,
    expiresIn: config.jwt.expiresIn
  });
}));

/**
 * POST /api/auth/refresh - Refresh access token
 */
router.post('/refresh', validateBody(authSchemas.refreshToken), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const ipAddress = getClientIp(req);

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Check if refresh token exists in database
  const tokenRecord = await UserModel.findRefreshToken(refreshToken);
  if (!tokenRecord) {
    await logSecurityEvent(
      EVENT_TYPES.TOKEN_INVALID,
      SEVERITY.MEDIUM,
      {
        userId: decoded.id,
        username: decoded.username,
        ipAddress,
        reason: 'Token not found'
      }
    );
    throw new AuthenticationError('Invalid refresh token');
  }

  // Check if token is expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    await UserModel.deleteRefreshToken(refreshToken);
    await logSecurityEvent(
      EVENT_TYPES.TOKEN_EXPIRED,
      SEVERITY.LOW,
      {
        userId: decoded.id,
        username: decoded.username,
        ipAddress
      }
    );
    throw new AuthenticationError('Refresh token expired');
  }

  // Get user
  const user = await UserModel.findByUsername(decoded.username);
  if (!user || !user.is_active) {
    throw new AuthenticationError('User not found or inactive');
  }

  // Rotate refresh token (delete old, create new)
  await UserModel.deleteRefreshToken(refreshToken);
  
  // Generate new tokens
  const newAccessToken = generateAccessToken(user);
  const newRefreshToken = generateRefreshToken(user);
  
  // Save new refresh token
  const refreshExpiration = getTokenExpiration(config.jwt.refreshExpiresIn);
  const userAgent = getUserAgent(req);
  await UserModel.saveRefreshToken(user.id, newRefreshToken, refreshExpiration, ipAddress, userAgent);

  // Update last used time
  await UserModel.updateRefreshTokenLastUsed(newRefreshToken);

  await logSecurityEvent(
    EVENT_TYPES.TOKEN_REFRESH,
    SEVERITY.LOW,
    {
      userId: user.id,
      username: user.username,
      ipAddress
    }
  );

  logger.info(`Token refreshed for user: ${user.username}`);

  res.json({
    success: true,
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    expiresIn: config.jwt.expiresIn
  });
}));

/**
 * POST /api/auth/logout - Logout user
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;
  const token = req.headers.authorization?.split(' ')[1];

  // Blacklist access token if it has jti
  if (token) {
    try {
      const jwt = require('jsonwebtoken');
      const decoded = jwt.decode(token);
      
      if (decoded && decoded.jti) {
        const expiresAt = new Date(decoded.exp * 1000).toISOString();
        await UserModel.blacklistToken(decoded.jti, req.user.id, expiresAt);
      }
    } catch (error) {
      logger.error('Error blacklisting token:', error);
    }
  }

  if (refreshToken) {
    // Delete specific refresh token
    await UserModel.deleteRefreshToken(refreshToken);
  } else {
    // Delete all refresh tokens for user
    await UserModel.deleteUserRefreshTokens(req.user.id);
  }

  await logSecurityEvent(
    EVENT_TYPES.LOGOUT,
    SEVERITY.LOW,
    {
      userId: req.user.id,
      username: req.user.username,
      ipAddress: getClientIp(req)
    }
  );

  logger.info(`User logged out: ${req.user.username}`);

  res.json({
    success: true,
    message: 'Logout successful'
  });
}));

/**
 * GET /api/auth/me - Get current user
 */
router.get('/me', authenticate, asyncHandler(async (req, res) => {
  res.json({
    success: true,
    user: req.user
  });
}));

module.exports = router;
