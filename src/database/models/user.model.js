/**
 * User Model
 * Handles user data and authentication
 */

const db = require('../connection');
const bcrypt = require('bcrypt');
const { v4: uuidv4 } = require('uuid');
const config = require('../../config');
const logger = require('../../utils/logger');

class UserModel {
  /**
   * Create a new user
   */
  static async create(userData) {
    const { username, email, password, role } = userData;
    
    const passwordHash = await bcrypt.hash(password, config.security.bcryptRounds);
    const id = uuidv4();
    const now = new Date().toISOString();
    
    try {
      await db.run(
        `INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at, is_active, failed_login_attempts, version)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, username, email, passwordHash, role, now, now, 1, 0, 1]
      );
      
      logger.info(`User created: ${username} (${role})`);
      return await this.findById(id);
    } catch (error) {
      if (error.message.includes('UNIQUE constraint failed')) {
        throw new Error('Username or email already exists');
      }
      throw error;
    }
  }

  /**
   * Find user by ID
   */
  static async findById(id) {
    const user = await db.get('SELECT * FROM users WHERE id = ?', [id]);
    return user ? this.sanitizeUser(user) : null;
  }

  /**
   * Find user by username
   */
  static async findByUsername(username) {
    return await db.get('SELECT * FROM users WHERE username = ?', [username]);
  }

  /**
   * Find user by email
   */
  static async findByEmail(email) {
    return await db.get('SELECT * FROM users WHERE email = ?', [email]);
  }

  /**
   * Verify password
   */
  static async verifyPassword(plainPassword, hashedPassword) {
    return await bcrypt.compare(plainPassword, hashedPassword);
  }

  /**
   * Update last login and IP
   */
  static async updateLastLogin(userId, ipAddress = null) {
    const now = new Date().toISOString();
    await db.run(
      'UPDATE users SET last_login = ?, last_login_ip = ?, updated_at = ?, failed_login_attempts = 0 WHERE id = ?',
      [now, ipAddress, now, userId]
    );
  }

  /**
   * Update last activity (for session timeout)
   */
  static async updateLastActivity(userId, ipAddress = null) {
    const now = new Date().toISOString();
    await db.run(
      'UPDATE users SET last_login = ?, last_login_ip = ?, updated_at = ? WHERE id = ?',
      [now, ipAddress, now, userId]
    );
  }

  /**
   * Increment failed login attempts
   */
  static async incrementFailedLoginAttempts(userId) {
    const user = await db.get('SELECT failed_login_attempts FROM users WHERE id = ?', [userId]);
    const attempts = (user?.failed_login_attempts || 0) + 1;
    
    await db.run(
      'UPDATE users SET failed_login_attempts = ?, updated_at = ? WHERE id = ?',
      [attempts, new Date().toISOString(), userId]
    );
    
    // Lock account if max attempts reached
    if (attempts >= config.session.maxLoginAttempts) {
      await this.lockAccount(userId);
    }
    
    return attempts;
  }

  /**
   * Lock account
   */
  static async lockAccount(userId) {
    const lockedUntil = new Date(Date.now() + config.session.lockoutDurationMs).toISOString();
    await db.run(
      'UPDATE users SET locked_until = ?, updated_at = ? WHERE id = ?',
      [lockedUntil, new Date().toISOString(), userId]
    );
    logger.warn(`Account locked: ${userId} until ${lockedUntil}`);
  }

  /**
   * Unlock account
   */
  static async unlockAccount(userId) {
    await db.run(
      'UPDATE users SET locked_until = NULL, failed_login_attempts = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), userId]
    );
    logger.info(`Account unlocked: ${userId}`);
  }

  /**
   * Get all users (admin only)
   */
  static async findAll() {
    const users = await db.all('SELECT * FROM users WHERE is_active = 1');
    return users.map(user => this.sanitizeUser(user));
  }

  /**
   * Deactivate user
   */
  static async deactivate(userId) {
    await db.run(
      'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), userId]
    );
    logger.info(`User deactivated: ${userId}`);
  }

  /**
   * Suspend user account (for suspicious activity)
   */
  static async suspend(userId, reason) {
    await db.run(
      'UPDATE users SET is_active = 0, updated_at = ? WHERE id = ?',
      [new Date().toISOString(), userId]
    );
    logger.warn(`User suspended: ${userId}, reason: ${reason}`);
  }

  /**
   * Remove password from user object
   */
  static sanitizeUser(user) {
    if (!user) return null;
    const { password_hash, ...sanitized } = user;
    return sanitized;
  }

  /**
   * Save refresh token
   */
  static async saveRefreshToken(userId, token, expiresAt, ipAddress = null, userAgent = null) {
    await db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at, created_at, ip_address, user_agent) VALUES (?, ?, ?, ?, ?, ?)',
      [userId, token, expiresAt, new Date().toISOString(), ipAddress, userAgent]
    );
  }

  /**
   * Find refresh token
   */
  static async findRefreshToken(token) {
    return await db.get('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
  }

  /**
   * Update refresh token last used
   */
  static async updateRefreshTokenLastUsed(token) {
    await db.run(
      'UPDATE refresh_tokens SET last_used_at = ? WHERE token = ?',
      [new Date().toISOString(), token]
    );
  }

  /**
   * Delete refresh token
   */
  static async deleteRefreshToken(token) {
    await db.run('DELETE FROM refresh_tokens WHERE token = ?', [token]);
  }

  /**
   * Delete all user refresh tokens
   */
  static async deleteUserRefreshTokens(userId) {
    await db.run('DELETE FROM refresh_tokens WHERE user_id = ?', [userId]);
  }

  /**
   * Delete expired refresh tokens (cleanup)
   */
  static async deleteExpiredRefreshTokens() {
    const now = new Date().toISOString();
    await db.run('DELETE FROM refresh_tokens WHERE expires_at < ?', [now]);
  }

  /**
   * Blacklist token (for logout)
   */
  static async blacklistToken(jti, userId, expiresAt) {
    try {
      await db.run(
        'INSERT INTO token_blacklist (jti, user_id, expires_at, blacklisted_at) VALUES (?, ?, ?, ?)',
        [jti, userId, expiresAt, new Date().toISOString()]
      );
    } catch (error) {
      // Ignore duplicate errors
      if (!error.message.includes('UNIQUE constraint failed')) {
        throw error;
      }
    }
  }

  /**
   * Cleanup expired blacklisted tokens
   */
  static async cleanupBlacklistedTokens() {
    const now = new Date().toISOString();
    await db.run('DELETE FROM token_blacklist WHERE expires_at < ?', [now]);
  }

  /**
   * Update user with optimistic locking
   */
  static async updateWithLocking(userId, updates, currentVersion) {
    const newVersion = currentVersion + 1;
    const now = new Date().toISOString();
    
    const fields = Object.keys(updates).map(key => `${key} = ?`).join(', ');
    const values = [...Object.values(updates), newVersion, now, userId, currentVersion];
    
    const result = await db.run(
      `UPDATE users SET ${fields}, version = ?, updated_at = ? WHERE id = ? AND version = ?`,
      values
    );
    
    if (result.changes === 0) {
      throw new Error('Concurrent modification detected. Please refresh and try again.');
    }
    
    return await this.findById(userId);
  }
}

module.exports = UserModel;
