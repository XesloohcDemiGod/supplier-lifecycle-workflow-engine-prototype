/**
 * Validation Middleware
 * Validates request body, query, and params using Joi schemas
 */

const logger = require('../utils/logger');

/**
 * Validate request body against a Joi schema
 */
const validateBody = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.body, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Validation error:', { path: req.path, errors });

      return res.status(400).json({
        error: 'Validation failed',
        details: errors
      });
    }

    // Replace body with validated and sanitized value
    req.body = value;
    next();
  };
};

/**
 * Validate query parameters against a Joi schema
 */
const validateQuery = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.query, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Query validation error:', { path: req.path, errors });

      return res.status(400).json({
        error: 'Invalid query parameters',
        details: errors
      });
    }

    req.query = value;
    next();
  };
};

/**
 * Validate URL parameters against a Joi schema
 */
const validateParams = (schema) => {
  return (req, res, next) => {
    const { error, value } = schema.validate(req.params, {
      abortEarly: false,
      stripUnknown: true
    });

    if (error) {
      const errors = error.details.map(detail => ({
        field: detail.path.join('.'),
        message: detail.message
      }));

      logger.warn('Params validation error:', { path: req.path, errors });

      return res.status(400).json({
        error: 'Invalid URL parameters',
        details: errors
      });
    }

    req.params = value;
    next();
  };
};

module.exports = {
  validateBody,
  validateQuery,
  validateParams
};
