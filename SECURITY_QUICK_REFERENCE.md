# Security Quick Reference Guide

Quick reference for developers working with the security features.

## Table of Contents
- [Authentication](#authentication)
- [Rate Limiting](#rate-limiting)
- [Input Validation](#input-validation)
- [Data Protection](#data-protection)
- [Error Handling](#error-handling)
- [Testing](#testing)

## Authentication

### Protecting Routes

```javascript
// Require authentication
router.get('/protected', authenticate, (req, res) => {
  // req.user is available
});

// Require specific role
router.post('/admin-only', 
  authenticate, 
  authorize('Admin'), 
  (req, res) => {
    // Only admins can access
  }
);

// Multiple roles allowed
router.put('/reviewers', 
  authenticate, 
  authorize('Admin', 'Reviewer'), 
  (req, res) => {
    // Admins and Reviewers can access
  }
);

// Check resource ownership
router.get('/suppliers/:id', 
  authenticate, 
  checkOwnership('supplier'), 
  (req, res) => {
    // User can only access their own resources
  }
);

// Optional authentication
router.get('/public-data', 
  optionalAuthenticate, 
  (req, res) => {
    // req.user is available if authenticated, undefined otherwise
  }
);
```

### Login Response

```javascript
{
  "success": true,
  "message": "Login successful",
  "user": {
    "id": "uuid",
    "username": "john",
    "email": "john@example.com",
    "role": "Buyer"
  },
  "accessToken": "eyJhbGc...",
  "refreshToken": "eyJhbGc...",
  "expiresIn": "15m"
}
```

### Making Authenticated Requests

```bash
curl -H "Authorization: Bearer <access_token>" \
  http://localhost:3000/api/suppliers
```

## Rate Limiting

### Applying Rate Limits

```javascript
// IP-based rate limiting (applied to all /api/ routes)
app.use('/api/', ipRateLimiter);

// User-based rate limiting
router.get('/data', 
  authenticate,
  userRateLimiter,
  getData
);

// Tiered rate limiting
router.get('/resources', 
  authenticate,
  tieredRateLimiter,
  getResources
);

// Endpoint-specific limits
router.post('/auth/login', authRateLimiter, login);
router.post('/auth/register', registrationRateLimiter, register);

// Request frequency tracking
router.post('/critical', 
  authenticate,
  requestFrequencyTracker,
  criticalOperation
);
```

### Rate Limit Response

```javascript
// 429 Too Many Requests
{
  "error": "Too many requests",
  "message": "You have exceeded the rate limit. Please try again later.",
  "retryAfter": 123  // seconds
}
```

### Rate Limit Headers

```
X-RateLimit-Limit: 100
X-RateLimit-Remaining: 45
X-RateLimit-Reset: 2025-12-25T09:00:00.000Z
X-RateLimit-Tier: STANDARD
```

## Input Validation

### Using Joi Schemas

```javascript
const { validateBody } = require('./middleware/validation.middleware');
const { supplierSchemas } = require('./validators/schemas');

router.post('/suppliers', 
  validateBody(supplierSchemas.createRequest),
  createSupplier
);
```

### Creating Custom Validators

```javascript
const Joi = require('joi');

const customSchema = Joi.object({
  name: Joi.string().trim().min(2).max(100).required(),
  email: validators.email.required(),
  categories: validators.limitedArray(
    Joi.string().max(50),
    100  // max items
  ),
  notes: Joi.string().trim().max(1000).optional()
});
```

### Validation Error Response

```javascript
{
  "error": "Validation error",
  "details": [
    {
      "message": "name must be at least 2 characters",
      "path": ["name"],
      "type": "string.min"
    }
  ]
}
```

## Data Protection

### Encrypting Sensitive Data

```javascript
const { encrypt, decrypt } = require('./utils/encryption');

// Encrypt
const encryptedTaxId = encrypt(taxId);
await db.run('UPDATE suppliers SET tax_id_encrypted = ? WHERE id = ?', 
  [encryptedTaxId, supplierId]);

// Decrypt
const taxId = decrypt(encryptedTaxId);
```

### Masking PII in Logs

```javascript
const { maskEmail, maskIp, mask } = require('./utils/encryption');

logger.info('User action', {
  email: maskEmail('john@example.com'),  // j***n@example.com
  ip: maskIp('192.168.1.100'),           // 192.168.***.***
  taxId: mask('12-3456789', 4)           // *****6789
});
```

### Sanitizing Input

```javascript
const { sanitizeInput, sanitizeHtml } = require('./utils/sanitization');

// Sanitize user input
const clean = sanitizeInput(userInput);

// Sanitize HTML
const safeHtml = sanitizeHtml('<script>alert(1)</script>');
// Output: &lt;script&gt;alert(1)&lt;/script&gt;
```

## Error Handling

### Using Async Handler

```javascript
const { asyncHandler, NotFoundError, ConflictError } = require('./middleware/error.middleware');

router.post('/suppliers', asyncHandler(async (req, res) => {
  const existing = await SupplierModel.findByEmail(req.body.email);
  
  if (existing) {
    throw new ConflictError('Supplier already exists');
  }
  
  const supplier = await SupplierModel.create(req.body);
  res.status(201).json({ success: true, supplier });
}));
```

### Error Types

```javascript
// 400 Bad Request
throw new ValidationError('Invalid input');

// 401 Unauthorized
throw new AuthenticationError('Invalid credentials');

// 403 Forbidden
throw new ForbiddenError('Access denied');

// 404 Not Found
throw new NotFoundError('Supplier not found');

// 409 Conflict
throw new ConflictError('Resource already exists');

// 500 Internal Server Error
throw new Error('Something went wrong');
```

### Error Response Format

```javascript
{
  "error": "Error type",
  "message": "Detailed error message",
  "details": {}  // optional
}
```

## Security Features

### Optimistic Locking

```javascript
// Update with version check
const currentVersion = supplier.version;
const updates = { companyName: 'New Name' };

try {
  const updated = await SupplierModel.updateWithLocking(
    supplierId, 
    updates, 
    currentVersion
  );
} catch (error) {
  if (error.message.includes('Concurrent modification')) {
    // Handle conflict
    return res.status(409).json({
      error: 'Conflict',
      message: 'Resource was modified by another user. Please refresh.'
    });
  }
  throw error;
}
```

### Idempotency Keys

```javascript
// Client sends idempotency key
fetch('/api/suppliers', {
  method: 'POST',
  headers: {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
    'Idempotency-Key': generateUUID()  // Client-generated
  },
  body: JSON.stringify(data)
});

// Server middleware handles deduplication
router.post('/suppliers', 
  authenticate,
  idempotencyMiddleware(24),  // 24 hour expiry
  createSupplier
);
```

### Circuit Breaker

```javascript
const { dbCircuitBreaker } = require('./middleware/circuit-breaker.middleware');

// Wrap risky operations
const result = await dbCircuitBreaker.execute(async () => {
  return await performDatabaseOperation();
});

// Check circuit breaker state
const state = dbCircuitBreaker.getState();
// { state: 'CLOSED', failures: 0, successes: 0 }
```

### Security Event Logging

```javascript
const { logSecurityEvent, SEVERITY, EVENT_TYPES } = require('./utils/security-logger');

// Log security event
await logSecurityEvent(
  EVENT_TYPES.UNAUTHORIZED_ACCESS,
  SEVERITY.HIGH,
  {
    userId: req.user.id,
    username: req.user.username,
    ipAddress: req.ip,
    action: 'attempted_admin_access',
    resource: '/admin/users'
  }
);
```

## Testing

### Test Authentication

```javascript
const request = require('supertest');
const app = require('./server');

// Login and get token
const loginRes = await request(app)
  .post('/api/auth/login')
  .send({ username: 'test', password: 'test123' });

const token = loginRes.body.accessToken;

// Use token in requests
const response = await request(app)
  .get('/api/suppliers')
  .set('Authorization', `Bearer ${token}`);

expect(response.status).toBe(200);
```

### Test Rate Limiting

```javascript
// Test IP rate limiting
for (let i = 0; i < 105; i++) {
  const res = await request(app).get('/api/suppliers');
  if (i < 100) {
    expect(res.status).toBe(200);
  } else {
    expect(res.status).toBe(429);
    expect(res.body.error).toBe('Too many requests');
  }
}
```

### Test Input Validation

```javascript
// Test invalid input
const response = await request(app)
  .post('/api/suppliers')
  .set('Authorization', `Bearer ${token}`)
  .send({
    companyName: 'A',  // Too short (min 2)
    contactEmail: 'invalid-email'
  });

expect(response.status).toBe(400);
expect(response.body.error).toBe('Validation error');
```

### Test Security Events

```javascript
const { getSecurityMetrics } = require('./utils/security-logger');

// Trigger security event
await request(app)
  .post('/api/auth/login')
  .send({ username: 'admin', password: 'wrong' });

// Check metrics
const metrics = await getSecurityMetrics(1);  // Last 1 hour
expect(metrics.failedLogins).toBeGreaterThan(0);
```

## Common Patterns

### Protected CRUD Operations

```javascript
// Create (authenticated + validated)
router.post('/', 
  authenticate,
  authorize('Admin', 'Buyer'),
  validateBody(schema.create),
  idempotencyMiddleware(24),
  asyncHandler(create)
);

// Read (authenticated + ownership check)
router.get('/:id', 
  authenticate,
  checkOwnership('resource'),
  asyncHandler(getById)
);

// Update (authenticated + ownership + validation + optimistic locking)
router.put('/:id', 
  authenticate,
  checkOwnership('resource'),
  validateBody(schema.update),
  asyncHandler(async (req, res) => {
    const updated = await Model.updateWithLocking(
      req.params.id,
      req.body,
      req.body.version
    );
    res.json({ success: true, data: updated });
  })
);

// Delete (authenticated + admin only)
router.delete('/:id', 
  authenticate,
  authorize('Admin'),
  asyncHandler(remove)
);
```

### Handling Security Responses

```javascript
// Check for rate limiting
if (response.status === 429) {
  const retryAfter = response.headers['retry-after'];
  console.log(`Rate limited. Retry after ${retryAfter} seconds`);
  return;
}

// Check for authentication errors
if (response.status === 401) {
  // Try to refresh token
  const newToken = await refreshAccessToken(refreshToken);
  // Retry request with new token
}

// Check for permission errors
if (response.status === 403) {
  console.log('Access denied. Insufficient permissions.');
  return;
}

// Check for validation errors
if (response.status === 400) {
  const errors = response.body.details;
  errors.forEach(err => {
    console.log(`${err.path}: ${err.message}`);
  });
}
```

## Environment Configuration

### Development

```bash
NODE_ENV=development
JWT_EXPIRES_IN=15m
SESSION_TIMEOUT=30m
MAX_LOGIN_ATTEMPTS=5
RATE_LIMIT_MAX_REQUESTS=100
```

### Production

```bash
NODE_ENV=production
JWT_SECRET=<strong-random-key>
JWT_EXPIRES_IN=15m
SESSION_TIMEOUT=30m
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=15m
RATE_LIMIT_MAX_REQUESTS=100
CORS_ALLOWED_ORIGINS=https://app.example.com,https://www.example.com
TLS_MIN_VERSION=TLSv1.3
```

### Testing

```bash
NODE_ENV=test
JWT_SECRET=test-secret
JWT_EXPIRES_IN=1h  # Longer for testing
SESSION_TIMEOUT=2h
RATE_LIMIT_MAX_REQUESTS=10000  # Higher for tests
```

## Troubleshooting

### Account Locked

**Problem:** User cannot login, receives "Account locked" error

**Solution:**
```sql
-- Check lockout status
SELECT locked_until, failed_login_attempts 
FROM users 
WHERE username = 'user';

-- Manually unlock (admin only)
UPDATE users 
SET locked_until = NULL, failed_login_attempts = 0 
WHERE username = 'user';
```

### Rate Limit Hit

**Problem:** Getting 429 errors

**Solution:**
- Wait for the time specified in `Retry-After` header
- Check rate limit headers for remaining quota
- Consider upgrading to higher tier (if applicable)

### Token Expired

**Problem:** Getting 401 "Token expired" error

**Solution:**
```javascript
// Use refresh token to get new access token
const response = await fetch('/api/auth/refresh', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({ refreshToken })
});

const { accessToken } = await response.json();
```

### Concurrent Modification

**Problem:** Getting 409 "Concurrent modification detected"

**Solution:**
```javascript
// Fetch latest version
const latest = await fetch(`/api/suppliers/${id}`);
const supplier = await latest.json();

// Retry update with latest version
const response = await fetch(`/api/suppliers/${id}`, {
  method: 'PUT',
  body: JSON.stringify({
    ...updates,
    version: supplier.version
  })
});
```

## Best Practices

1. **Always use async/await** with asyncHandler wrapper
2. **Always validate input** before processing
3. **Always authenticate** sensitive endpoints
4. **Always check permissions** for resource access
5. **Always log security events** for suspicious activity
6. **Always use HTTPS** in production
7. **Always mask PII** in logs
8. **Always handle errors** gracefully
9. **Always use optimistic locking** for concurrent updates
10. **Always test security features** thoroughly

## Quick Links

- [Full Security Documentation](./SECURITY.md)
- [API Documentation](./API.md)
- [Setup Guide](./SETUP.md)
- [Environment Variables](./.env.example)

## Support

For security questions or issues:
1. Check security event logs: `/api/security/metrics` (admin only)
2. Review health check: `/health`
3. Check application logs in `./logs/`
4. Contact security team for critical issues
