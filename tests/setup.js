/**
 * Test Setup
 * Runs before all tests
 */

const fs = require('fs');
const path = require('path');

// Use test database
process.env.DB_PATH = './data/test-suppliers.sqlite';
process.env.LOG_LEVEL = 'error'; // Reduce log noise in tests
process.env.NODE_ENV = 'test';

// Clean up test database before tests
beforeAll(() => {
  const dbPath = path.join(__dirname, '../data/test-suppliers.sqlite');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});

// Clean up test database after all tests
afterAll(() => {
  const dbPath = path.join(__dirname, '../data/test-suppliers.sqlite');
  if (fs.existsSync(dbPath)) {
    fs.unlinkSync(dbPath);
  }
});
