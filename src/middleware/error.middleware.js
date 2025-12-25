/**
 * Error Handler Middleware
 * Centralized error handling for the application
 */

const logger = require('../utils/logger');
const config = require('../config');

/**
 * Error codes
 */
const ErrorCodes = {
  VALIDATION_ERROR: 'VALIDATION_ERROR',
  AUTHENTICATION_ERROR: 'AUTHENTICATION_ERROR',
  AUTHORIZATION_ERROR: 'AUTHORIZATION_ERROR',
  NOT_FOUND: 'NOT_FOUND',
  CONFLICT: 'CONFLICT',
  INVALID_STATE_TRANSITION: 'INVALID_STATE_TRANSITION',
  DATABASE_ERROR: 'DATABASE_ERROR',
  INTERNAL_ERROR: 'INTERNAL_ERROR'
};

/**
 * Custom Application Error
 */
class AppError extends Error {
  constructor(message, statusCode = 500, code = ErrorCodes.INTERNAL_ERROR, details = null) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.details = details;
    this.isOperational = true;
    Error.captureStackTrace(this, this.constructor);
  }
}

/**
 * Not Found Error
 */
class NotFoundError extends AppError {
  constructor(resource, id = null) {
    const message = id ? `${resource} with id '${id}' not found` : `${resource} not found`;
    super(message, 404, ErrorCodes.NOT_FOUND);
  }
}

/**
 * Validation Error
 */
class ValidationError extends AppError {
  constructor(message, details = null) {
    super(message, 400, ErrorCodes.VALIDATION_ERROR, details);
  }
}

/**
 * Authentication Error
 */
class AuthenticationError extends AppError {
  constructor(message = 'Authentication failed') {
    super(message, 401, ErrorCodes.AUTHENTICATION_ERROR);
  }
}

/**
 * Authorization Error
 */
class AuthorizationError extends AppError {
  constructor(message = 'Access denied') {
    super(message, 403, ErrorCodes.AUTHORIZATION_ERROR);
  }
}

/**
 * Conflict Error
 */
class ConflictError extends AppError {
  constructor(message) {
    super(message, 409, ErrorCodes.CONFLICT);
  }
}

/**
 * Invalid State Transition Error
 */
class InvalidStateTransitionError extends AppError {
  constructor(currentState, newState) {
    super(
      `Invalid state transition from ${currentState} to ${newState}`,
      400,
      ErrorCodes.INVALID_STATE_TRANSITION
    );
  }
}

/**
 * Database Error
 */
class DatabaseError extends AppError {
  constructor(message, originalError = null) {
    super(message, 500, ErrorCodes.DATABASE_ERROR);
    this.originalError = originalError;
  }
}

/**
 * Error handler middleware
 */
const errorHandler = (err, req, res, next) => {
  let error = err;

  // Handle non-AppError errors
  if (!(error instanceof AppError)) {
    // Handle database errors
    if (error.name === 'SqliteError' || error.name === 'DatabaseError') {
      error = new DatabaseError('Database operation failed', error);
    }
    // Handle JWT errors
    else if (error.name === 'JsonWebTokenError') {
      error = new AuthenticationError('Invalid token');
    } else if (error.name === 'TokenExpiredError') {
      error = new AuthenticationError('Token expired');
    }
    // Generic internal error
    else {
      error = new AppError(
        config.env === 'production' ? 'Internal server error' : error.message,
        500,
        ErrorCodes.INTERNAL_ERROR
      );
    }
  }

  // Log error
  const logData = {
    code: error.code,
    message: error.message,
    statusCode: error.statusCode,
    path: req.path,
    method: req.method,
    user: req.user ? req.user.username : 'anonymous',
    ip: req.ip
  };

  if (error.statusCode >= 500) {
    logger.error('Server error:', { ...logData, stack: error.stack });
  } else {
    logger.warn('Client error:', logData);
  }

  // Send error response
  const response = {
    error: error.message,
    code: error.code,
    ...(error.details && { details: error.details })
  };

  // Include stack trace in development
  if (config.env === 'development' && error.stack) {
    response.stack = error.stack;
  }

  res.status(error.statusCode).json(response);
};

/**
 * 404 handler
 */
const notFoundHandler = (req, res, next) => {
  const error = new NotFoundError('Route');
  next(error);
};

/**
 * Async handler wrapper
 */
const asyncHandler = (fn) => {
  return (req, res, next) => {
    Promise.resolve(fn(req, res, next)).catch(next);
  };
};

module.exports = {
  ErrorCodes,
  AppError,
  NotFoundError,
  ValidationError,
  AuthenticationError,
  AuthorizationError,
  ConflictError,
  InvalidStateTransitionError,
  DatabaseError,
  errorHandler,
  notFoundHandler,
  asyncHandler
};
