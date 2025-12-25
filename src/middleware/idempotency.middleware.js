/**
 * Idempotency Key Middleware
 * Prevent duplicate operations using idempotency keys
 */

const crypto = require('crypto');
const db = require('../database/connection');
const logger = require('../utils/logger');

/**
 * Generate hash for request
 */
const generateRequestHash = (req) => {
  const content = JSON.stringify({
    method: req.method,
    path: req.path,
    body: req.body,
    userId: req.user?.id
  });
  
  return crypto.createHash('sha256').update(content).digest('hex');
};

/**
 * Idempotency middleware
 * Ensures that duplicate requests with the same idempotency key return the same response
 */
const idempotencyMiddleware = (expiryHours = 24) => {
  return async (req, res, next) => {
    // Only apply to POST, PUT, PATCH, DELETE
    if (!['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
      return next();
    }

    // Get idempotency key from header
    const idempotencyKey = req.get('Idempotency-Key');
    
    if (!idempotencyKey) {
      // No idempotency key provided, continue normally
      return next();
    }

    // Validate idempotency key format (should be UUID or similar)
    if (!/^[a-zA-Z0-9\-_]{16,128}$/.test(idempotencyKey)) {
      return res.status(400).json({
        error: 'Invalid idempotency key',
        message: 'Idempotency key must be 16-128 alphanumeric characters'
      });
    }

    // Require authentication for idempotency
    if (!req.user) {
      return res.status(401).json({
        error: 'Authentication required',
        message: 'Idempotency keys require authentication'
      });
    }

    try {
      // Generate request hash
      const requestHash = generateRequestHash(req);
      
      // Check if idempotency key exists
      const existing = await db.get(
        `SELECT * FROM idempotency_keys WHERE key = ? AND user_id = ?`,
        [idempotencyKey, req.user.id]
      );

      if (existing) {
        // Check if expired
        if (new Date(existing.expires_at) < new Date()) {
          // Expired, delete and continue with new request
          await db.run('DELETE FROM idempotency_keys WHERE key = ?', [idempotencyKey]);
        } else {
          // Check if request hash matches
          if (existing.request_hash !== requestHash) {
            return res.status(422).json({
              error: 'Idempotency key mismatch',
              message: 'This idempotency key was used for a different request'
            });
          }

          // Return cached response
          if (existing.response) {
            logger.info('Returning cached idempotent response', {
              key: idempotencyKey,
              userId: req.user.id
            });

            const cachedResponse = JSON.parse(existing.response);
            return res.status(cachedResponse.statusCode || 200).json(cachedResponse.body);
          }

          // Request is still processing (rare race condition)
          return res.status(409).json({
            error: 'Request in progress',
            message: 'A request with this idempotency key is already being processed'
          });
        }
      }

      // Store idempotency key (without response yet)
      const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000).toISOString();
      
      await db.run(
        `INSERT INTO idempotency_keys (key, user_id, endpoint, request_hash, created_at, expires_at)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [idempotencyKey, req.user.id, req.path, requestHash, new Date().toISOString(), expiresAt]
      );

      // Intercept response to cache it
      const originalJson = res.json.bind(res);
      res.json = function(body) {
        // Cache the response
        const response = {
          statusCode: res.statusCode,
          body
        };

        db.run(
          'UPDATE idempotency_keys SET response = ? WHERE key = ?',
          [JSON.stringify(response), idempotencyKey]
        ).catch(err => {
          logger.error('Failed to cache idempotent response:', err);
        });

        return originalJson(body);
      };

      next();
    } catch (error) {
      logger.error('Idempotency middleware error:', error);
      // Fail open - continue without idempotency protection
      next();
    }
  };
};

/**
 * Cleanup expired idempotency keys
 */
const cleanupExpiredKeys = async () => {
  try {
    const now = new Date().toISOString();
    await db.run('DELETE FROM idempotency_keys WHERE expires_at < ?', [now]);
    logger.info('Cleaned up expired idempotency keys');
  } catch (error) {
    logger.error('Error cleaning up idempotency keys:', error);
  }
};

module.exports = {
  idempotencyMiddleware,
  cleanupExpiredKeys
};
