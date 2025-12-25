/**
 * Database Initialization Script
 * Creates tables and seeds initial data
 */

const db = require('./connection');
const SCHEMA = require('./schema');
const logger = require('../utils/logger');
const bcrypt = require('bcrypt');
const config = require('../config');
const { v4: uuidv4 } = require('uuid');

async function initializeDatabase() {
  try {
    logger.info('Initializing database...');
    
    // Connect to database
    await db.connect();
    
    // Create tables
    logger.info('Creating database schema...');
    await db.exec(SCHEMA);
    
    // Seed default admin user
    logger.info('Checking for default users...');
    const existingAdmin = await db.get('SELECT * FROM users WHERE username = ?', ['admin']);
    
    if (!existingAdmin) {
      logger.info('Creating default admin user...');
      const passwordHash = await bcrypt.hash('admin123', config.security.bcryptRounds);
      const adminId = uuidv4();
      
      await db.run(
        `INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at, is_active)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          adminId,
          'admin',
          'admin@example.com',
          passwordHash,
          'Admin',
          new Date().toISOString(),
          new Date().toISOString(),
          1
        ]
      );
      
      logger.info('Default admin user created (username: admin, password: admin123)');
    }
    
    // Create other default users for testing
    const testUsers = [
      { username: 'buyer1', email: 'buyer@example.com', role: 'Buyer', password: 'buyer123' },
      { username: 'reviewer1', email: 'reviewer@example.com', role: 'Reviewer', password: 'reviewer123' },
      { username: 'finance1', email: 'finance@example.com', role: 'Finance', password: 'finance123' },
      { username: 'supplier1', email: 'supplier@example.com', role: 'Supplier', password: 'supplier123' }
    ];
    
    for (const user of testUsers) {
      const existing = await db.get('SELECT * FROM users WHERE username = ?', [user.username]);
      if (!existing) {
        const passwordHash = await bcrypt.hash(user.password, config.security.bcryptRounds);
        await db.run(
          `INSERT INTO users (id, username, email, password_hash, role, created_at, updated_at, is_active)
           VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
          [
            uuidv4(),
            user.username,
            user.email,
            passwordHash,
            user.role,
            new Date().toISOString(),
            new Date().toISOString(),
            1
          ]
        );
        logger.info(`Test user created: ${user.username} (password: ${user.password})`);
      }
    }
    
    logger.info('Database initialization completed successfully');
    
  } catch (error) {
    logger.error('Database initialization failed:', error);
    throw error;
  }
}

// Run if called directly
if (require.main === module) {
  initializeDatabase()
    .then(() => {
      process.exit(0);
    })
    .catch((error) => {
      console.error('Initialization failed:', error);
      process.exit(1);
    });
}

module.exports = initializeDatabase;
