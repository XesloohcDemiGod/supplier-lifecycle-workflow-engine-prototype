/**
 * Circuit Breaker Middleware
 * Protect against cascading failures and overload
 */

const logger = require('../utils/logger');

class CircuitBreaker {
  constructor(options = {}) {
    this.failureThreshold = options.failureThreshold || 5;
    this.successThreshold = options.successThreshold || 2;
    this.timeout = options.timeout || 60000; // 60 seconds
    this.monitoringPeriod = options.monitoringPeriod || 10000; // 10 seconds
    
    this.state = 'CLOSED'; // CLOSED, OPEN, HALF_OPEN
    this.failures = 0;
    this.successes = 0;
    this.nextAttempt = Date.now();
    this.recentRequests = [];
  }

  /**
   * Execute function with circuit breaker protection
   */
  async execute(fn) {
    if (this.state === 'OPEN') {
      if (Date.now() < this.nextAttempt) {
        const ServiceUnavailableError = require('../middleware/error.middleware').ServiceUnavailableError || Error;
        const error = new ServiceUnavailableError('Service temporarily unavailable due to circuit breaker');
        error.circuitBreakerOpen = true;
        throw error;
      }
      
      // Try to recover
      this.state = 'HALF_OPEN';
      this.successes = 0;
    }

    try {
      const result = await fn();
      this.onSuccess();
      return result;
    } catch (error) {
      this.onFailure();
      throw error;
    }
  }

  /**
   * Handle successful request
   */
  onSuccess() {
    this.failures = 0;
    
    if (this.state === 'HALF_OPEN') {
      this.successes++;
      
      if (this.successes >= this.successThreshold) {
        this.state = 'CLOSED';
        this.successes = 0;
        logger.info('Circuit breaker closed after recovery');
      }
    }
  }

  /**
   * Handle failed request
   */
  onFailure() {
    this.failures++;
    
    if (this.state === 'HALF_OPEN') {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.warn('Circuit breaker reopened after failure in HALF_OPEN state');
    } else if (this.failures >= this.failureThreshold) {
      this.state = 'OPEN';
      this.nextAttempt = Date.now() + this.timeout;
      logger.error('Circuit breaker opened due to failures', {
        failures: this.failures,
        threshold: this.failureThreshold
      });
    }
  }

  /**
   * Track request rate
   */
  trackRequest() {
    const now = Date.now();
    this.recentRequests.push(now);
    
    // Remove old requests outside monitoring period
    this.recentRequests = this.recentRequests.filter(
      time => now - time < this.monitoringPeriod
    );
    
    return this.recentRequests.length;
  }

  /**
   * Get current state
   */
  getState() {
    return {
      state: this.state,
      failures: this.failures,
      successes: this.successes,
      nextAttempt: this.state === 'OPEN' ? new Date(this.nextAttempt).toISOString() : null,
      requestRate: this.recentRequests.length
    };
  }
}

// Global circuit breaker for database operations
const dbCircuitBreaker = new CircuitBreaker({
  failureThreshold: 10,
  successThreshold: 3,
  timeout: 30000,
  monitoringPeriod: 10000
});

// Global circuit breaker for external API calls
const apiCircuitBreaker = new CircuitBreaker({
  failureThreshold: 5,
  successThreshold: 2,
  timeout: 60000,
  monitoringPeriod: 10000
});

/**
 * Circuit breaker middleware for routes
 */
const circuitBreakerMiddleware = (circuitBreaker) => {
  return async (req, res, next) => {
    if (circuitBreaker.state === 'OPEN') {
      const state = circuitBreaker.getState();
      
      return res.status(503).json({
        error: 'Service temporarily unavailable',
        message: 'The service is experiencing high load. Please try again later.',
        retryAfter: Math.ceil((state.nextAttempt ? new Date(state.nextAttempt).getTime() - Date.now() : 30000) / 1000),
        circuitState: state.state
      });
    }

    // Track request rate
    const requestRate = circuitBreaker.trackRequest();
    
    // Add circuit breaker state to response headers
    res.set('X-Circuit-Breaker-State', circuitBreaker.state);
    res.set('X-Request-Rate', requestRate.toString());

    next();
  };
};

/**
 * Wrap database operations with circuit breaker
 */
const wrapWithCircuitBreaker = (circuitBreaker, fn) => {
  return async (...args) => {
    return await circuitBreaker.execute(() => fn(...args));
  };
};

/**
 * Health check endpoint data
 */
const getCircuitBreakerHealth = () => {
  return {
    database: dbCircuitBreaker.getState(),
    externalApi: apiCircuitBreaker.getState()
  };
};

module.exports = {
  CircuitBreaker,
  dbCircuitBreaker,
  apiCircuitBreaker,
  circuitBreakerMiddleware,
  wrapWithCircuitBreaker,
  getCircuitBreakerHealth
};
