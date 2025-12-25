/**
 * Supplier Lifecycle Management System - Server
 * Main entry point for the application
 */

const express = require('express');
const path = require('path');
const helmet = require('helmet');
const cors = require('cors');
const rateLimit = require('express-rate-limit');

// Load environment config
const config = require('./config');
const logger = require('./utils/logger');
const db = require('./database/connection');
const initializeDatabase = require('./database/init-db');

// Middleware
const { skipHealthCheck } = require('./middleware/request-logger.middleware');
const { errorHandler, notFoundHandler } = require('./middleware/error.middleware');

// Routes
const authRoutes = require('./routes/auth.routes');
const supplierRoutes = require('./routes/supplier.routes');
const taskRoutes = require('./routes/task.routes');
const legacyApiRoutes = require('./api'); // Keep for backwards compatibility

const app = express();

// Security middleware
app.use(helmet({
  contentSecurityPolicy: {
    directives: {
      defaultSrc: ["'self'"],
      scriptSrc: ["'self'", "'unsafe-inline'"], // Allow inline scripts for simple UI
      styleSrc: ["'self'", "'unsafe-inline'"], // Allow inline styles
      imgSrc: ["'self'", "data:", "https:"],
      connectSrc: ["'self'"]
    }
  }
}));

// CORS
app.use(cors({
  origin: config.cors.origin,
  credentials: true
}));

// Rate limiting
const limiter = rateLimit({
  windowMs: config.security.rateLimitWindowMs,
  max: config.security.rateLimitMaxRequests,
  message: 'Too many requests from this IP, please try again later.',
  standardHeaders: true,
  legacyHeaders: false
});

app.use('/api/', limiter);

// Body parsing middleware
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Request logging (skip for health check)
app.use(skipHealthCheck);

// Static files (for UI)
app.use(express.static(path.join(__dirname, '../public')));

// Root route - serve index page
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '../public/index.html'));
});

// Health check
app.get('/health', async (req, res) => {
  const health = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    uptime: process.uptime(),
    database: db.isConnected ? 'connected' : 'disconnected'
  };

  if (db.isConnected) {
    res.json(health);
  } else {
    res.status(503).json({ ...health, status: 'unhealthy' });
  }
});

// API routes (new with auth)
app.use('/api/auth', authRoutes);
app.use('/api/suppliers', supplierRoutes);
app.use('/api/tasks', taskRoutes);

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

// Initialize and start server
const startServer = async () => {
  try {
    // Initialize database
    await initializeDatabase();

    // Start server
    const server = app.listen(config.port, config.host, () => {
      logger.info(`Supplier Lifecycle Management System running on http://${config.host}:${config.port}`);
      logger.info(`Environment: ${config.env}`);
      logger.info(`API available at http://${config.host}:${config.port}/api`);
      logger.info(`UI available at http://${config.host}:${config.port}`);
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
