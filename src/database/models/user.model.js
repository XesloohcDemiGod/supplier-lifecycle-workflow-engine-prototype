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
        `INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [id, username, email, passwordHash, role, now, now, 1]
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
   * Update last login
   */
  static async updateLastLogin(userId) {
    const now = new Date().toISOString();
    await db.run(
      'UPDATE users SET last_login = ?, updated_at = ? WHERE id = ?',
      [now, now, userId]
    );
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
  static async saveRefreshToken(userId, token, expiresAt) {
    await db.run(
      'INSERT INTO refresh_tokens (user_id, token, expires_at, created_at) VALUES (?, ?, ?, ?)',
      [userId, token, expiresAt, new Date().toISOString()]
    );
  }

  /**
   * Find refresh token
   */
  static async findRefreshToken(token) {
    return await db.get('SELECT * FROM refresh_tokens WHERE token = ?', [token]);
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
}

module.exports = UserModel;
