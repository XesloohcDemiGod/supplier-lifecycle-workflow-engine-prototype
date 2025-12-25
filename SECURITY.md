# Security Implementation Guide

This document describes the comprehensive security hardening and abuse prevention mechanisms implemented in the Supplier Lifecycle Workflow Engine.

## Table of Contents

1. [Security Overview](#security-overview)
2. [Authentication & Authorization](#authentication--authorization)
3. [Rate Limiting & Throttling](#rate-limiting--throttling)
4. [Input Validation & Sanitization](#input-validation--sanitization)
5. [Data Protection & Encryption](#data-protection--encryption)
6. [Security Headers](#security-headers)
7. [Fraud Detection](#fraud-detection)
8. [Monitoring & Logging](#monitoring--logging)
9. [DDoS Protection](#ddos-protection)
10. [Business Logic Protection](#business-logic-protection)
11. [Configuration](#configuration)
12. [OWASP Top 10 Compliance](#owasp-top-10-compliance)

## Security Overview

The system implements defense-in-depth with multiple layers of security:

- **Perimeter Security**: Rate limiting, IP blocking, CORS
- **Authentication Layer**: JWT tokens, session management, account lockout
- **Authorization Layer**: Role-based access control, resource ownership
- **Input Layer**: Sanitization, validation, injection prevention
- **Data Layer**: Encryption at rest, secure deletion, PII masking
- **Application Layer**: Optimistic locking, idempotency keys, circuit breakers
- **Monitoring Layer**: Security event logging, anomaly detection, metrics

## Authentication & Authorization

### JWT Token Security

**Access Tokens:**
- Expiry: 15 minutes
- Algorithm: HS256 (configurable)
- Includes: user ID, username, email, role, JTI (unique token ID)

**Refresh Tokens:**
- Expiry: 7 days
- Rotation: New token issued on each refresh
- Storage: Database with IP address and user agent tracking
- Revocation: Token blacklisting on logout

**Token Blacklisting:**
```javascript
// Tokens are blacklisted on logout and checked on every request
const isBlacklisted = await isTokenBlacklisted(decoded.jti);
```

### Session Security

**Session Timeout:**
- Inactivity timeout: 30 minutes
- Tracked via last_login timestamp
- Automatically invalidates expired sessions

**Account Lockout:**
- Failed attempts threshold: 5 attempts
- Lockout duration: 15 minutes
- Automatic unlock after lockout period
- Tracks attempts per user

**Geographic Anomaly Detection:**
- Tracks login IP address
- Detects logins from different geographic regions
- Logs suspicious activity

### Role-Based Access Control (RBAC)

**Roles:**
- `Buyer`: Submit supplier requests, view own requests
- `Supplier`: Register, view own profile
- `Reviewer`: Review assigned suppliers
- `Finance`: Financial operations
- `Admin`: Full system access

**Permission Hierarchy:**
- Admin has access to all resources
- Role escalation is prevented and logged
- Resource ownership is verified

**Resource Ownership:**
```javascript
// Buyers can only access suppliers they requested
checkOwnership('supplier')

// Suppliers can only access their own profile
supplier.contact_email === req.user.email
```

## Rate Limiting & Throttling

### IP-Based Rate Limiting

**Default Limits:**
- Window: 15 minutes (900,000 ms)
- Max requests: 100 per window
- Response: 429 Too Many Requests with Retry-After header

### User-Based Rate Limiting

**Per-User Limits:**
- Window: 5 minutes (300,000 ms)
- Max requests: 50 per window

### Tiered Rate Limiting

**Rate Limit Tiers:**

| Tier | Role | Requests/Minute |
|------|------|-----------------|
| FREE | Unauthenticated | 10 |
| BASIC | Supplier | 100 |
| STANDARD | Buyer | 500 |
| PREMIUM | Admin/Reviewer | 1000 |

### Endpoint-Specific Limits

**Authentication Endpoints:**
- Login: 5 attempts per 15 minutes
- Registration: 3 attempts per hour
- Password Reset: 3 attempts per hour

**Fraud Detection:**
- Account creation: Max 5 per hour per IP
- Rapid requests: Max 10 per minute per user

## Input Validation & Sanitization

### Injection Prevention

**SQL Injection:**
- Parameterized queries (all database operations)
- Pattern detection and logging
- Automatic sanitization

**NoSQL Injection:**
- MongoDB operator filtering (`$` removal)
- Pattern detection

**XSS (Cross-Site Scripting):**
- HTML entity encoding
- Content Security Policy headers
- Pattern detection (script tags, event handlers)

**Command Injection:**
- Shell metacharacter removal
- Pattern detection (pipes, redirects, etc.)

**LDAP Injection:**
- Special character escaping
- Pattern detection

**CSV/Excel Injection:**
- Formula character detection
- Automatic prefixing with single quote

**ReDoS Prevention:**
- Safe regex pattern validation
- Nested quantifier detection

### Validation Rules

**String Lengths:**
- Company names: 2-255 characters
- Usernames: 3-30 characters
- Passwords: 6-128 characters
- Email: Max 255 characters
- Notes/Comments: Max 1000 characters

**Array Limits:**
- Categories: Max 100 items
- General arrays: Max 100 items (configurable)

**Character Whitelisting:**
- Company names: `[a-zA-Z0-9\s\-&.,'"()]+`
- Usernames: Alphanumeric only
- Addresses: Alphanumeric + safe punctuation

## Data Protection & Encryption

### Encryption at Rest

**Algorithm:** AES-256-GCM (Galois/Counter Mode)

**Encrypted Fields:**
- Tax IDs
- Bank account numbers
- Other sensitive PII

**Implementation:**
```javascript
const encrypted = encrypt(sensitiveData);
const decrypted = decrypt(encryptedData);
```

### PII Masking in Logs

**Masked Data:**
- Email addresses: `j***n@example.com`
- IP addresses: `192.168.***.***`
- Tax IDs: `***-****789`

**Implementation:**
```javascript
logger.info('User login', {
  email: maskEmail(user.email),
  ip: maskIp(req.ip)
});
```

### CORS Configuration

**Allowed Origins:**
- Configured via `CORS_ALLOWED_ORIGINS` environment variable
- Multiple origins supported (comma-separated)
- Credentials enabled for authenticated requests

**Default:**
```
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com
```

### TLS Configuration

**Minimum Version:** TLS 1.2+

**Recommendations:**
- Use TLS 1.3 in production
- Strong cipher suites only
- HSTS with preload

## Security Headers

### Helmet Configuration

**Content Security Policy (CSP):**
```javascript
{
  defaultSrc: ["'self'"],
  scriptSrc: ["'self'", "'unsafe-inline'"],
  styleSrc: ["'self'", "'unsafe-inline'"],
  imgSrc: ["'self'", "data:", "https:"],
  connectSrc: ["'self'"],
  fontSrc: ["'self'"],
  objectSrc: ["'none'"],
  mediaSrc: ["'self'"],
  frameSrc: ["'none'"]
}
```

**Other Headers:**
- `Strict-Transport-Security`: max-age=31536000; includeSubDomains; preload
- `X-Content-Type-Options`: nosniff
- `X-Frame-Options`: DENY
- `X-XSS-Protection`: 1; mode=block
- `Referrer-Policy`: strict-origin-when-cross-origin
- `Permissions-Policy`: Restricts dangerous features
- `Cross-Origin-Embedder-Policy`: require-corp
- `Cross-Origin-Opener-Policy`: same-origin
- `Cross-Origin-Resource-Policy`: same-origin

## Fraud Detection

### Account Creation Abuse

**Limits:**
- Max 5 account creations per hour per IP
- Tracked in `account_creation_tracking` table
- Automatic cleanup of old records

**Response:**
```json
{
  "error": "Too many account creation attempts",
  "message": "Maximum account creation limit reached from this IP address."
}
```

### Rapid Request Detection

**Limits:**
- Max 10 requests per minute per user
- Separate from standard rate limiting
- Triggers high-severity security event

**Implementation:**
```javascript
requestFrequencyTracker(req, res, next)
```

### Geographic Anomaly Detection

**Detection:**
- Tracks last login IP address
- Compares with current login IP
- Logs medium-severity event on mismatch

**Future Enhancements:**
- GeoIP database integration
- Country-level comparison
- Automatic account suspension option

## Monitoring & Logging

### Security Event Logging

**Event Types:**
- LOGIN_SUCCESS, LOGIN_FAILED, LOGIN_LOCKED
- TOKEN_REFRESH, TOKEN_EXPIRED, TOKEN_INVALID
- ACCOUNT_CREATED, ACCOUNT_LOCKED, ACCOUNT_SUSPENDED
- RATE_LIMIT_EXCEEDED, UNAUTHORIZED_ACCESS, PERMISSION_DENIED
- SQL_INJECTION_ATTEMPT, XSS_ATTEMPT, CSRF_ATTEMPT
- GEOGRAPHIC_ANOMALY, RAPID_REQUESTS, ACCOUNT_CREATION_ABUSE
- CONCURRENT_MODIFICATION, STATE_TRANSITION_VIOLATION

**Severity Levels:**
- LOW: Informational events
- MEDIUM: Suspicious but not critical
- HIGH: Potential security threats
- CRITICAL: Active attacks or breaches

**Database Storage:**
```sql
CREATE TABLE security_events (
  id INTEGER PRIMARY KEY AUTOINCREMENT,
  event_type TEXT NOT NULL,
  user_id TEXT,
  username TEXT,
  ip_address TEXT,
  user_agent TEXT,
  details TEXT,
  severity TEXT NOT NULL,
  timestamp TEXT NOT NULL,
  resolved INTEGER DEFAULT 0
);
```

### Security Metrics Endpoint

**Endpoint:** `GET /api/security/metrics`

**Authorization:** Admin only

**Response:**
```json
{
  "success": true,
  "metrics": {
    "totalEvents": 1234,
    "criticalEvents": 5,
    "highEvents": 42,
    "failedLogins": 89,
    "rateLimitExceeded": 156,
    "unauthorizedAccess": 23,
    "suspiciousActivity": 12
  },
  "windowHours": 24
}
```

### Winston Logging

**Log Files:**
- `logs/combined.log`: All logs
- `logs/error.log`: Error-level only

**Log Format:** JSON with timestamp

**PII Protection:** All PII is masked in logs

## DDoS Protection

### Circuit Breaker Pattern

**Purpose:** Prevent cascading failures during system overload

**States:**
- CLOSED: Normal operation
- OPEN: Circuit tripped, rejecting requests
- HALF_OPEN: Testing recovery

**Configuration:**
- Failure threshold: 5-10 failures
- Success threshold: 2-3 successes to recover
- Timeout: 30-60 seconds

**Usage:**
```javascript
// Wrap database operations
const result = await dbCircuitBreaker.execute(() => 
  db.query('SELECT * FROM suppliers')
);
```

### Request Timeout

**Default:** 30 seconds

**Behavior:** Automatically terminates long-running requests

**Response:**
```json
{
  "error": "Request timeout",
  "message": "Request took too long to process"
}
```

### Connection Limits

**Per-IP Connections:** 10 (configurable)

**Implementation:** Via rate limiting middleware

## Business Logic Protection

### Optimistic Locking

**Purpose:** Prevent concurrent modification conflicts

**Implementation:**
```javascript
// Version field in database
version INTEGER DEFAULT 1

// Update with version check
await SupplierModel.updateWithLocking(id, updates, currentVersion);
```

**Error Response:**
```json
{
  "error": "Concurrent modification detected",
  "message": "Please refresh and try again."
}
```

### Idempotency Keys

**Purpose:** Prevent duplicate operations

**Header:** `Idempotency-Key: <uuid>`

**Expiry:** 24 hours (configurable)

**Implementation:**
```javascript
// Apply to critical endpoints
router.post('/suppliers', 
  idempotencyMiddleware(24),
  createSupplier
);
```

**Cached Response:** Returns same response for duplicate requests

### Duplicate Prevention

**Supplier Registration:**
- Checks for existing company name + email combination
- Prevents duplicate supplier entries

**Implementation:**
```javascript
const existing = await SupplierModel.findByCompanyAndEmail(
  companyName, 
  contactEmail
);
if (existing) {
  throw new Error('Supplier already exists');
}
```

### State Transition Validation

**Validation:** Ensures valid state machine transitions

**Prevention:** Invalid state changes are rejected

**Logging:** All state transitions are audited

## Configuration

### Environment Variables

**Required:**
```bash
JWT_SECRET=your-secret-key-change-in-production
```

**Security Settings:**
```bash
# JWT & Session
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d
SESSION_TIMEOUT=30m
MAX_LOGIN_ATTEMPTS=5
LOCKOUT_DURATION=15m

# Rate Limiting
RATE_LIMIT_WINDOW_MS=900000
RATE_LIMIT_MAX_REQUESTS=100
RATE_LIMIT_PER_USER_WINDOW_MS=300000
RATE_LIMIT_PER_USER_MAX_REQUESTS=50

# Request Limits
MAX_REQUEST_SIZE=5mb
MAX_FILE_SIZE=50mb
MAX_ARRAY_SIZE=100
MAX_STRING_LENGTH=1000

# Fraud Detection
MAX_ACCOUNT_CREATIONS_PER_HOUR=5
MAX_REQUESTS_PER_MINUTE_PER_USER=10

# DDoS Protection
REQUEST_TIMEOUT_MS=30000
MAX_CONNECTIONS_PER_IP=10

# CORS
CORS_ALLOWED_ORIGINS=http://localhost:3000,https://app.example.com

# TLS
TLS_MIN_VERSION=TLSv1.2
```

### Production Recommendations

1. **JWT Secret:** Use strong, random 256-bit key
2. **HTTPS:** Always use TLS 1.2+ in production
3. **Database:** Enable encryption at rest
4. **Monitoring:** Integrate with SIEM system
5. **Backups:** Regular encrypted backups
6. **Updates:** Keep dependencies up to date
7. **Audits:** Regular security audits
8. **Logging:** Centralized log aggregation

## OWASP Top 10 Compliance

### A01: Broken Access Control ✅
- Role-based access control (RBAC)
- Resource ownership verification
- Role escalation prevention
- Permission checks on all sensitive operations

### A02: Cryptographic Failures ✅
- AES-256-GCM encryption for sensitive data
- TLS 1.2+ for all network communications
- Secure password hashing (bcrypt)
- Proper key management

### A03: Injection ✅
- Parameterized queries (SQL injection prevention)
- Input sanitization (XSS, NoSQL, Command, LDAP)
- Pattern detection and logging
- Character whitelisting

### A04: Insecure Design ✅
- Optimistic locking for concurrency
- Idempotency keys for critical operations
- Circuit breaker pattern
- State machine validation

### A05: Security Misconfiguration ✅
- Strict security headers (CSP, HSTS, etc.)
- Server identification removed
- Secure defaults
- Configuration validation

### A06: Vulnerable and Outdated Components ✅
- Regular dependency updates
- Automated vulnerability scanning
- Up-to-date libraries

### A07: Identification and Authentication Failures ✅
- Account lockout after failed attempts
- Session timeout
- Token blacklisting
- Refresh token rotation

### A08: Software and Data Integrity Failures ✅
- Token verification (JWT)
- Optimistic locking
- State transition validation
- Audit trail

### A09: Security Logging and Monitoring Failures ✅
- Comprehensive security event logging
- Failed login tracking
- Anomaly detection
- Security metrics endpoint

### A10: Server-Side Request Forgery ✅
- Input validation
- URL sanitization
- Whitelist for external requests

## Testing Security Features

### Manual Testing

**Rate Limiting:**
```bash
# Test IP rate limiting
for i in {1..105}; do curl http://localhost:3000/api/suppliers; done

# Should return 429 after 100 requests
```

**Account Lockout:**
```bash
# Test failed login lockout
for i in {1..6}; do 
  curl -X POST http://localhost:3000/api/auth/login \
    -H "Content-Type: application/json" \
    -d '{"username":"test","password":"wrong"}'
done

# Account should be locked after 5 failures
```

**Token Expiry:**
```bash
# Login and wait 16 minutes
TOKEN=$(curl -X POST http://localhost:3000/api/auth/login \
  -H "Content-Type: application/json" \
  -d '{"username":"admin","password":"admin123"}' \
  | jq -r '.accessToken')

sleep 960  # Wait 16 minutes

# Should return 401 Token Expired
curl http://localhost:3000/api/auth/me \
  -H "Authorization: Bearer $TOKEN"
```

### Automated Testing

Run existing test suite:
```bash
npm test
```

## Incident Response

### Security Event Response

1. **Detection:** Monitor `security_events` table
2. **Assessment:** Check event severity and details
3. **Containment:** 
   - Lock compromised accounts
   - Blacklist suspicious IPs
   - Revoke tokens
4. **Investigation:** Review audit trail
5. **Recovery:** Reset credentials, unlock accounts
6. **Lessons Learned:** Update security policies

### High-Severity Event Actions

**CRITICAL Events:**
- Immediate alert to administrators
- Automatic account suspension
- IP blocking (manual for now)

**HIGH Events:**
- Log for review
- Increase monitoring
- Consider account suspension

## Future Enhancements

1. **Redis Integration:** Distributed rate limiting
2. **GeoIP Database:** Accurate geographic anomaly detection
3. **Machine Learning:** Advanced fraud detection
4. **SIEM Integration:** Centralized security monitoring
5. **2FA/MFA:** Two-factor authentication
6. **Biometric Auth:** Fingerprint/Face ID support
7. **WAF:** Web Application Firewall integration
8. **IP Reputation:** Third-party IP reputation services
9. **Behavioral Analytics:** User behavior profiling
10. **Automated Response:** Auto-blocking of threats

## References

- [OWASP Top 10](https://owasp.org/Top10/)
- [OWASP Cheat Sheet Series](https://cheatsheetseries.owasp.org/)
- [NIST Cybersecurity Framework](https://www.nist.gov/cyberframework)
- [CWE Top 25](https://cwe.mitre.org/top25/)
- [Express.js Security Best Practices](https://expressjs.com/en/advanced/best-practice-security.html)

## Support

For security concerns or questions, contact the security team or review the security event logs via the admin dashboard.

**Security Metrics:** `GET /api/security/metrics` (Admin only)

**Health Check:** `GET /health` (Public)
