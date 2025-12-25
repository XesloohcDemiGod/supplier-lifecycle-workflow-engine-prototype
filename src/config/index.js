/**
 * Configuration Module
 * Loads and validates environment variables
 */

require('dotenv').config();

const parseTime = (timeStr) => {
  const match = timeStr.match(/^(\d+)(ms|s|m|h|d)$/);
  if (!match) return 0;
  
  const value = parseInt(match[1], 10);
  const unit = match[2];
  
  const multipliers = {
    ms: 1,
    s: 1000,
    m: 60000,
    h: 3600000,
    d: 86400000
  };
  
  return value * multipliers[unit];
};

const config = {
  env: process.env.NODE_ENV || 'development',
  port: parseInt(process.env.PORT || '3000', 10),
  host: process.env.HOST || 'localhost',
  
  database: {
    path: process.env.DB_PATH || './data/suppliers.sqlite',
    poolMin: parseInt(process.env.DB_POOL_MIN || '2', 10),
    poolMax: parseInt(process.env.DB_POOL_MAX || '10', 10)
  },
  
  jwt: {
    secret: process.env.JWT_SECRET || 'dev-secret-key',
    expiresIn: process.env.JWT_EXPIRES_IN || '15m',
    refreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN || '7d'
  },
  
  session: {
    timeoutMs: parseTime(process.env.SESSION_TIMEOUT || '30m'),
    maxLoginAttempts: parseInt(process.env.MAX_LOGIN_ATTEMPTS || '5', 10),
    lockoutDurationMs: parseTime(process.env.LOCKOUT_DURATION || '15m')
  },
  
  security: {
    bcryptRounds: parseInt(process.env.BCRYPT_ROUNDS || '10', 10),
    rateLimitWindowMs: parseInt(process.env.RATE_LIMIT_WINDOW_MS || '900000', 10),
    rateLimitMaxRequests: parseInt(process.env.RATE_LIMIT_MAX_REQUESTS || '100', 10),
    rateLimitPerUserWindowMs: parseInt(process.env.RATE_LIMIT_PER_USER_WINDOW_MS || '300000', 10),
    rateLimitPerUserMaxRequests: parseInt(process.env.RATE_LIMIT_PER_USER_MAX_REQUESTS || '50', 10),
    maxRequestSize: process.env.MAX_REQUEST_SIZE || '5mb',
    maxFileSize: process.env.MAX_FILE_SIZE || '50mb',
    maxArraySize: parseInt(process.env.MAX_ARRAY_SIZE || '100', 10),
    maxStringLength: parseInt(process.env.MAX_STRING_LENGTH || '1000', 10),
    tlsMinVersion: process.env.TLS_MIN_VERSION || 'TLSv1.2',
    requestTimeoutMs: parseInt(process.env.REQUEST_TIMEOUT_MS || '30000', 10),
    maxConnectionsPerIp: parseInt(process.env.MAX_CONNECTIONS_PER_IP || '10', 10)
  },
  
  fraudDetection: {
    maxAccountCreationsPerHour: parseInt(process.env.MAX_ACCOUNT_CREATIONS_PER_HOUR || '5', 10),
    maxRequestsPerMinutePerUser: parseInt(process.env.MAX_REQUESTS_PER_MINUTE_PER_USER || '10', 10)
  },
  
  logging: {
    level: process.env.LOG_LEVEL || 'info',
    dir: process.env.LOG_DIR || './logs'
  },
  
  cors: {
    origins: process.env.CORS_ALLOWED_ORIGINS 
      ? process.env.CORS_ALLOWED_ORIGINS.split(',').map(o => o.trim())
      : ['http://localhost:3000']
  },
  
  redis: {
    enabled: process.env.REDIS_ENABLED === 'true',
    host: process.env.REDIS_HOST || 'localhost',
    port: parseInt(process.env.REDIS_PORT || '6379', 10),
    password: process.env.REDIS_PASSWORD || undefined
  }
};

// Validate critical config
if (config.env === 'production') {
  if (config.jwt.secret === 'dev-secret-key') {
    console.error('ERROR: JWT_SECRET must be set in production environment');
    process.exit(1);
  }
  
  if (config.jwt.expiresIn !== '15m') {
    console.warn('WARNING: JWT_EXPIRES_IN should be 15m for production');
  }
}

module.exports = config;
