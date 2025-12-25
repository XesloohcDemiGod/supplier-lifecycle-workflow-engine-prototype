/**
 * Rate Limiting Middleware
 * Comprehensive rate limiting with per-IP, per-user, and per-endpoint limits
 */

const rateLimit = require('express-rate-limit');
const config = require('../config');
const db = require('../database/connection');
const { logSecurityEvent, SEVERITY, EVENT_TYPES } = require('../utils/security-logger');
const logger = require('../utils/logger');

// Rate limit tiers based on user role
const RATE_LIMIT_TIERS = {
  FREE: { window: 60000, max: 10 },           // 10 requests/minute (no auth)
  BASIC: { window: 60000, max: 100 },         // 100 requests/minute (supplier)
  STANDARD: { window: 60000, max: 500 },      // 500 requests/minute (buyer)
  PREMIUM: { window: 60000, max: 1000 }       // 1000 requests/minute (admin/reviewer)
};

const ROLE_TO_TIER = {
  Supplier: 'BASIC',
  Buyer: 'STANDARD',
  Reviewer: 'PREMIUM',
  Finance: 'PREMIUM',
  Admin: 'PREMIUM'
};

/**
 * Store for tracking rate limits (in-memory fallback when Redis not available)
 */
class InMemoryStore {
  constructor() {
    this.hits = new Map();
    this.resetTime = new Map();
  }

  async increment(key, windowMs) {
    const now = Date.now();
    const resetTime = this.resetTime.get(key);

    // Reset if window expired
    if (!resetTime || now > resetTime) {
      this.hits.set(key, 1);
      this.resetTime.set(key, now + windowMs);
      return { totalHits: 1, resetTime: now + windowMs };
    }

    // Increment
    const hits = (this.hits.get(key) || 0) + 1;
    this.hits.set(key, hits);
    return { totalHits: hits, resetTime };
  }

  async decrement(key) {
    const hits = this.hits.get(key) || 0;
    if (hits > 0) {
      this.hits.set(key, hits - 1);
    }
  }

  async resetKey(key) {
    this.hits.delete(key);
    this.resetTime.delete(key);
  }

  // Cleanup old entries periodically
  cleanup() {
    const now = Date.now();
    for (const [key, resetTime] of this.resetTime.entries()) {
      if (now > resetTime) {
        this.hits.delete(key);
        this.resetTime.delete(key);
      }
    }
  }
}

// In-memory store instance
const store = new InMemoryStore();

// Cleanup flag to prevent multiple intervals
let cleanupInterval = null;

// Start cleanup if not already running
const startCleanup = () => {
  if (!cleanupInterval) {
    cleanupInterval = setInterval(() => store.cleanup(), 60000);
  }
};

// Initialize cleanup
if (process.env.NODE_ENV !== 'test') {
  startCleanup();
}

/**
 * Custom rate limit handler
 */
const rateLimitHandler = (req, res) => {
  const retryAfter = Math.ceil((req.rateLimit.resetTime - Date.now()) / 1000);
  
  // Log rate limit violation
  logSecurityEvent(
    EVENT_TYPES.RATE_LIMIT_EXCEEDED,
    SEVERITY.MEDIUM,
    {
      userId: req.user?.id,
      username: req.user?.username,
      ipAddress: req.ip,
      path: req.path,
      method: req.method,
      userAgent: req.get('user-agent')
    }
  ).catch(err => logger.error('Failed to log rate limit violation:', err));

  res.set('Retry-After', retryAfter);
  res.status(429).json({
    error: 'Too many requests',
    message: 'You have exceeded the rate limit. Please try again later.',
    retryAfter: retryAfter
  });
};

/**
 * Per-IP rate limiter (100 requests per 15 minutes)
 */
const ipRateLimiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false,
  handler: rateLimitHandler
  // Use default keyGenerator which properly handles IPv6
});

/**
 * Per-user rate limiter (50 requests per 5 minutes)
 */
const userRateLimiter = async (req, res, next) => {
  // Skip if no user
  if (!req.user) {
    return next();
  }

  const key = `user:${req.user.id}`;
  const windowMs = config.security.rateLimitPerUserWindowMs;
  const maxRequests = config.security.rateLimitPerUserMaxRequests;

  try {
    const { totalHits, resetTime } = await store.increment(key, windowMs);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', maxRequests);
    res.set('X-RateLimit-Remaining', Math.max(0, maxRequests - totalHits));
    res.set('X-RateLimit-Reset', new Date(resetTime).toISOString());

    // Attach to request for handler
    req.rateLimit = {
      limit: maxRequests,
      current: totalHits,
      remaining: Math.max(0, maxRequests - totalHits),
      resetTime
    };

    if (totalHits > maxRequests) {
      return rateLimitHandler(req, res);
    }

    next();
  } catch (error) {
    logger.error('User rate limiter error:', error);
    // Fail open - allow request if rate limiter fails
    next();
  }
};

/**
 * Per-endpoint rate limiter factory
 */
const createEndpointLimiter = (maxRequests, windowMs) => {
  return rateLimit({
    windowMs,
    max: maxRequests,
    message: `Too many requests to this endpoint, please try again later.`,
    standardHeaders: true,
    legacyHeaders: false,
    handler: rateLimitHandler
  });
};

/**
 * Tiered rate limiter based on user role
 */
const tieredRateLimiter = async (req, res, next) => {
  let tier = 'FREE';
  
  if (req.user && req.user.role) {
    tier = ROLE_TO_TIER[req.user.role] || 'FREE';
  }

  const limits = RATE_LIMIT_TIERS[tier];
  const key = req.user ? `tier:user:${req.user.id}` : `tier:ip:${req.ip}`;

  try {
    const { totalHits, resetTime } = await store.increment(key, limits.window);

    // Set rate limit headers
    res.set('X-RateLimit-Limit', limits.max);
    res.set('X-RateLimit-Remaining', Math.max(0, limits.max - totalHits));
    res.set('X-RateLimit-Reset', new Date(resetTime).toISOString());
    res.set('X-RateLimit-Tier', tier);

    req.rateLimit = {
      limit: limits.max,
      current: totalHits,
      remaining: Math.max(0, limits.max - totalHits),
      resetTime,
      tier
    };

    if (totalHits > limits.max) {
      return rateLimitHandler(req, res);
    }

    next();
  } catch (error) {
    logger.error('Tiered rate limiter error:', error);
    next();
  }
};

/**
 * Specific rate limiters for sensitive endpoints
 */
const authRateLimiter = createEndpointLimiter(5, 15 * 60 * 1000); // 5 requests per 15 minutes
const registrationRateLimiter = createEndpointLimiter(3, 60 * 60 * 1000); // 3 requests per hour
const passwordResetRateLimiter = createEndpointLimiter(3, 60 * 60 * 1000); // 3 requests per hour

/**
 * Request frequency tracker (detect rapid submissions)
 */
const requestFrequencyTracker = async (req, res, next) => {
  if (!req.user) {
    return next();
  }

  const key = `frequency:${req.user.id}:${req.method}:${req.path}`;
  const windowMs = 60000; // 1 minute
  const maxRequests = config.fraudDetection.maxRequestsPerMinutePerUser;

  try {
    const { totalHits } = await store.increment(key, windowMs);

    if (totalHits > maxRequests) {
      // Log suspicious rapid requests
      await logSecurityEvent(
        EVENT_TYPES.RAPID_REQUESTS,
        SEVERITY.HIGH,
        {
          userId: req.user.id,
          username: req.user.username,
          ipAddress: req.ip,
          path: req.path,
          method: req.method,
          requestCount: totalHits
        }
      );

      // Return 429 but don't block completely
      return res.status(429).json({
        error: 'Suspicious activity detected',
        message: 'Too many rapid requests detected. Please slow down.'
      });
    }

    next();
  } catch (error) {
    logger.error('Request frequency tracker error:', error);
    next();
  }
};

module.exports = {
  ipRateLimiter,
  userRateLimiter,
  tieredRateLimiter,
  createEndpointLimiter,
  authRateLimiter,
  registrationRateLimiter,
  passwordResetRateLimiter,
  requestFrequencyTracker
};
