/**
 * Authentication Routes
 * Handles user registration, login, logout, token refresh
 */

const express = require('express');
const UserModel = require('../database/models/user.model');
const { generateAccessToken, generateRefreshToken, verifyRefreshToken, getTokenExpiration } = require('../utils/jwt');
const { validateBody } = require('../middleware/validation.middleware');
const { authSchemas } = require('../validators/schemas');
const { authenticate } = require('../middleware/auth.middleware');
const { asyncHandler, AuthenticationError, ConflictError } = require('../middleware/error.middleware');
const logger = require('../utils/logger');
const config = require('../config');

const router = express.Router();

/**
 * POST /api/auth/register - Register new user
 */
router.post('/register', validateBody(authSchemas.register), asyncHandler(async (req, res) => {
  const { username, email, password, role } = req.body;

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
router.post('/login', validateBody(authSchemas.login), asyncHandler(async (req, res) => {
  const { username, password } = req.body;

  // Find user
  const user = await UserModel.findByUsername(username);
  if (!user) {
    throw new AuthenticationError('Invalid username or password');
  }

  // Check if user is active
  if (!user.is_active) {
    throw new AuthenticationError('User account is inactive');
  }

  // Verify password
  const isValid = await UserModel.verifyPassword(password, user.password_hash);
  if (!isValid) {
    throw new AuthenticationError('Invalid username or password');
  }

  // Update last login
  await UserModel.updateLastLogin(user.id);

  // Generate tokens
  const accessToken = generateAccessToken(user);
  const refreshToken = generateRefreshToken(user);

  // Save refresh token
  const refreshExpiration = getTokenExpiration(config.jwt.refreshExpiresIn);
  await UserModel.saveRefreshToken(user.id, refreshToken, refreshExpiration);

  // Remove password from response
  const sanitizedUser = UserModel.sanitizeUser(user);

  logger.info(`User logged in: ${username}`);

  res.json({
    success: true,
    message: 'Login successful',
    user: sanitizedUser,
    accessToken,
    refreshToken
  });
}));

/**
 * POST /api/auth/refresh - Refresh access token
 */
router.post('/refresh', validateBody(authSchemas.refreshToken), asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  // Verify refresh token
  const decoded = verifyRefreshToken(refreshToken);

  // Check if refresh token exists in database
  const tokenRecord = await UserModel.findRefreshToken(refreshToken);
  if (!tokenRecord) {
    throw new AuthenticationError('Invalid refresh token');
  }

  // Check if token is expired
  if (new Date(tokenRecord.expires_at) < new Date()) {
    await UserModel.deleteRefreshToken(refreshToken);
    throw new AuthenticationError('Refresh token expired');
  }

  // Get user
  const user = await UserModel.findById(decoded.id);
  if (!user || !user.is_active) {
    throw new AuthenticationError('User not found or inactive');
  }

  // Generate new access token
  const accessToken = generateAccessToken(user);

  logger.info(`Token refreshed for user: ${user.username}`);

  res.json({
    success: true,
    accessToken
  });
}));

/**
 * POST /api/auth/logout - Logout user
 */
router.post('/logout', authenticate, asyncHandler(async (req, res) => {
  const { refreshToken } = req.body;

  if (refreshToken) {
    // Delete specific refresh token
    await UserModel.deleteRefreshToken(refreshToken);
  } else {
    // Delete all refresh tokens for user
    await UserModel.deleteUserRefreshTokens(req.user.id);
  }

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
