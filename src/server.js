/**
 * Supplier Lifecycle Management System - Server
 * Main entry point for the application
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');

// Load environment config
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./database/connection');
const initializeDatabase = require('./database/init-db');

// Middleware
const { skipHealthCheck } = require('./middleware/request-logger.middleware');
const { errorHandler, notFoundHandler, asyncHandler } = require('./middleware/error.middleware');
const { securityHeadersMiddleware } = require('./middleware/security-headers.middleware');
const { sanitizationMiddleware } = require('./middleware/sanitization.middleware');
const { ipRateLimiter, tieredRateLimiter } = require('./middleware/rate-limit.middleware');
const { authenticate, authorize } = require('./middleware/auth.middleware');

// Routes
const authRoutes = require('./routes/auth.routes');
const supplierRoutes = require('./routes/supplier.routes');
const taskRoutes = require('./routes/task.routes');
const legacyApiRoutes = require('./api'); // Keep for backwards compatibility

const app = express();

// Trust proxy (for accurate IP addresses behind load balancers)
app.set('trust proxy', 1);

// Remove X-Powered-By header
app.disable('x-powered-by');

// Security headers middleware (additional to helmet)
app.use(securityHeadersMiddleware);

// Security middleware - Helmet with strict CSP
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for simple UI
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"],
      fontSrc: ["'self'"],
      objectSrc: ["'none'"],
      mediaSrc: ["'self'"],
      frameSrc: ["'none'"]
    }
  },
  crossOriginEmbedderPolicy: true,
  crossOriginOpenerPolicy: { policy: "same-origin" },
  crossOriginResourcePolicy: { policy: "same-origin" },
  dnsPrefetchControl: { allow: false },
  frameguard: { action: 'deny' },
  hidePoweredBy: true,
  hsts: {
    maxAge: 31536000,
    includeSubDomains: true,
    preload: true
  },
  ieNoOpen: true,
  noSniff: true,
  referrerPolicy: { policy: 'strict-origin-when-cross-origin' },
  xssFilter: true
}));

// CORS with multiple origins support
app.use(cors({
  origin: function(origin, callback) {
    // Allow requests with no origin (mobile apps, curl, etc.)
    if (!origin) return callback(null, true);
    
    if (config.cors.origins.indexOf(origin) !== -1) {
      callback(null, true);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH'],
  allowedHeaders: ['Content-Type', 'Authorization'],
  exposedHeaders: ['X-RateLimit-Limit', 'X-RateLimit-Remaining', 'X-RateLimit-Reset'],
  maxAge: 86400 // 24 hours
}));

// Body parsing middleware with size limits
app.use(express.json({ 
  limit: config.security.maxRequestSize,
  verify: (req, res, buf) => {
    // Store raw body for signature verification if needed
    req.rawBody = buf;
  }
}));
app.use(express.urlencoded({ 
  extended: true,
  limit: config.security.maxRequestSize
}));

// Request timeout
app.use((req, res, next) => {
  req.setTimeout(config.security.requestTimeoutMs, () => {
    logger.warn('Request timeout:', { path: req.path, method: req.method, ip: req.ip });
    res.status(408).json({
      error: 'Request timeout',
      message: 'Request took too long to process'
    });
  });
  next();
});

// Input sanitization (detect and log injection attempts)
app.use(sanitizationMiddleware);

// Request logging (skip for health check)
app.use(skipHealthCheck);

// Static files (for UI)
app.use(express.static(path.join(__dirname, '../public')));

// Root route - serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check (no rate limiting)
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: db.isConnected ? 'connected' : 'disconnected',
    memory: {
      used: Math.round(process.memoryUsage().heapUsed / 1024 / 1024) + ' MB',
      total: Math.round(process.memoryUsage().heapTotal / 1024 / 1024) + ' MB'
    }
  };

  if (db.isConnected) {
    res.json(health);
  } else {
    res.status(503).json({ ...health, status: 'unhealthy' });
  }
});

// Per-IP rate limiting for all API routes
app.use('/api/', ipRateLimiter);

// API routes (new with auth)
app.use('/api/auth', authRoutes);
app.use('/api/suppliers', tieredRateLimiter, supplierRoutes);
app.use('/api/tasks', tieredRateLimiter, taskRoutes);

// Legacy API routes (backwards compatible, no auth)
app.use('/api/legacy', legacyApiRoutes);

// States endpoint
app.get('/api/states', (req, res) => {
  const { STATES } = require('./state-machine');
  res.json({
    success: true,
    states: Object.values(STATES)
  });
});

// Security metrics endpoint (admin only)
app.get('/api/security/metrics', authenticate, authorize('Admin'), asyncHandler(async (req, res) => {
  const { getSecurityMetrics } = require('./utils/security-logger');
  
  const windowHours = parseInt(req.query.hours) || 24;
  const metrics = await getSecurityMetrics(windowHours);
  
  res.json({
    success: true,
    metrics,
    windowHours
  });
}));

// 404 handler
app.use(notFoundHandler);

// Error handler (must be last)
app.use(errorHandler);

// Graceful shutdown
const shutdown = async (signal) => {
  logger.info(`${signal} received. Starting graceful shutdown...`);

  // Close database connection
  try {
    await db.close();
    logger.info('Database connection closed');
  } catch (error) {
    logger.error('Error closing database:', error);
  }

  process.exit(0);
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// Periodic cleanup tasks
const startCleanupTasks = () => {
  const { cleanupExpiredKeys } = require('./middleware/idempotency.middleware');
  
  // Clean up expired tokens every hour
  setInterval(async () => {
    try {
      const UserModel = require('./database/models/user.model');
      await UserModel.deleteExpiredRefreshTokens();
      await UserModel.cleanupBlacklistedTokens();
      logger.info('Completed periodic token cleanup');
    } catch (error) {
      logger.error('Error in token cleanup:', error);
    }
  }, 60 * 60 * 1000); // Every hour

  // Clean up expired idempotency keys every hour
  setInterval(async () => {
    try {
      await cleanupExpiredKeys();
    } catch (error) {
      logger.error('Error in idempotency key cleanup:', error);
    }
  }, 60 * 60 * 1000); // Every hour
};

// Initialize and start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    // Start cleanup tasks
    startCleanupTasks();

    // Start server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`Supplier Lifecycle Management System running on http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API available at http://${config.host}:${config.port}/api`);
      logger.info(`UI available at http://${config.host}:${config.port}`);
      logger.info(`JWT Token Expiry: ${config.jwt.expiresIn}`);
      logger.info(`Session Timeout: ${config.session.timeoutMs / 60000} minutes`);
    });

    // Handle server errors
    server.on('error', (error) => {
      logger.error('Server error:', error);
      process.exit(1);
    });
  } catch (error) {
    logger.error('Failed to start server:', error);
    process.exit(1);
  }
};

// Start server if not in test mode
if (require.main === module) {
  startServer();
}

module.exports = app;
