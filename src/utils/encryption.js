/**
 * Encryption Utilities
 * Encrypt and decrypt sensitive data
 */

const crypto = require('crypto');
const config = require('../config');

// Use JWT secret as encryption key (derive a key from it)
const getEncryptionKey = () => {
  // Derive a 32-byte key from JWT secret using SHA-256
  return crypto.createHash('sha256').update(config.jwt.secret).digest();
};

const ALGORITHM = 'aes-256-gcm';
const IV_LENGTH = 16;
const AUTH_TAG_LENGTH = 16;

/**
 * Encrypt sensitive data
 */
const encrypt = (text) => {
  if (!text) return null;
  
  try {
    const iv = crypto.randomBytes(IV_LENGTH);
    const key = getEncryptionKey();
    const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
    
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    
    const authTag = cipher.getAuthTag();
    
    // Return: iv + authTag + encrypted data (all in hex)
    return iv.toString('hex') + authTag.toString('hex') + encrypted;
  } catch (error) {
    throw new Error('Encryption failed: ' + error.message);
  }
};

/**
 * Decrypt sensitive data
 */
const decrypt = (encryptedText) => {
  if (!encryptedText) return null;
  
  try {
    const key = getEncryptionKey();
    
    // Extract iv, authTag, and encrypted data
    const iv = Buffer.from(encryptedText.slice(0, IV_LENGTH * 2), 'hex');
    const authTag = Buffer.from(encryptedText.slice(IV_LENGTH * 2, (IV_LENGTH + AUTH_TAG_LENGTH) * 2), 'hex');
    const encrypted = encryptedText.slice((IV_LENGTH + AUTH_TAG_LENGTH) * 2);
    
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(authTag);
    
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    
    return decrypted;
  } catch (error) {
    throw new Error('Decryption failed: ' + error.message);
  }
};

/**
 * Hash sensitive data (one-way)
 */
const hash = (text) => {
  if (!text) return null;
  return crypto.createHash('sha256').update(text).digest('hex');
};

/**
 * Mask sensitive data for logging
 */
const mask = (text, visibleChars = 4) => {
  if (!text) return null;
  if (text.length <= visibleChars) return '***';
  
  const visible = text.slice(-visibleChars);
  return '*'.repeat(text.length - visibleChars) + visible;
};

/**
 * Mask email for logging
 */
const maskEmail = (email) => {
  if (!email) return null;
  
  const [local, domain] = email.split('@');
  if (!local || !domain) return '***@***';
  
  const maskedLocal = local.charAt(0) + '*'.repeat(Math.max(local.length - 2, 0)) + local.slice(-1);
  return `${maskedLocal}@${domain}`;
};

/**
 * Mask IP address for logging (keep first 2 octets)
 */
const maskIp = (ip) => {
  if (!ip) return null;
  
  const parts = ip.split('.');
  if (parts.length !== 4) return '***.***.***.***.***';
  
  return `${parts[0]}.${parts[1]}.***.***.***`;
};

module.exports = {
  encrypt,
  decrypt,
  hash,
  mask,
  maskEmail,
  maskIp
};
