/**
 * Authentication Integration Tests
 */

const request = require('supertest');
const app = require('../../src/server');
const db = require('../../src/database/connection');
const initDb = require('../../src/database/init-db');

describe('Authentication API', () => {
  beforeAll(async () => {
    // Initialize test database
    await initDb();
  });

  afterAll(async () => {
    // Clean up and close database
    await db.close();
  });

  describe('POST /api/auth/register', () => {
    test('should register a new user with valid data', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'newtestuser',
          email: 'newtestuser@example.com',
          password: 'password123',
          role: 'Buyer'
        });

      expect(response.status).toBe(201);
      expect(response.body.success).toBe(true);
      expect(response.body.user).toHaveProperty('id');
      expect(response.body.user.username).toBe('newtestuser');
      expect(response.body.user.role).toBe('Buyer');
      expect(response.body.user).not.toHaveProperty('password_hash');
    });

    test('should reject registration with duplicate username', async () => {
      // Try to register with admin username
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'admin',
          email: 'admin2@example.com',
          password: 'password123',
          role: 'Admin'
        });

      expect(response.status).toBe(409);
      expect(response.body.error).toContain('already exists');
    });

    test('should reject registration with invalid role', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'invalidrole',
          email: 'invalidrole@example.com',
          password: 'password123',
          role: 'InvalidRole'
        });

      expect(response.status).toBe(400);
    });

    test('should reject registration with short username', async () => {
      const response = await request(app)
        .post('/api/auth/register')
        .send({
          username: 'ab',
          email: 'short@example.com',
          password: 'password123',
          role: 'Buyer'
        });

      expect(response.status).toBe(400);
    });
  });

  describe('POST /api/auth/login', () => {
    test('should login with valid credentials', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body).toHaveProperty('accessToken');
      expect(response.body).toHaveProperty('refreshToken');
      expect(response.body.user.username).toBe('admin');
    });

    test('should reject login with invalid password', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'wrongpassword'
        });

      expect(response.status).toBe(401);
    });

    test('should reject login with non-existent username', async () => {
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'nonexistent',
          password: 'password123'
        });

      expect(response.status).toBe(401);
    });
  });

  describe('GET /api/auth/me', () => {
    let accessToken;

    beforeAll(async () => {
      // Login to get token
      const response = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      accessToken = response.body.accessToken;
    });

    test('should return current user with valid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${accessToken}`);

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
      expect(response.body.user.username).toBe('admin');
    });

    test('should reject request without token', async () => {
      const response = await request(app).get('/api/auth/me');

      expect(response.status).toBe(401);
    });

    test('should reject request with invalid token', async () => {
      const response = await request(app)
        .get('/api/auth/me')
        .set('Authorization', 'Bearer invalid-token');

      expect(response.status).toBe(401);
    });
  });

  describe('POST /api/auth/logout', () => {
    test('should logout successfully with valid token', async () => {
      // Login first
      const loginResponse = await request(app)
        .post('/api/auth/login')
        .send({
          username: 'admin',
          password: 'admin123'
        });

      const { accessToken, refreshToken } = loginResponse.body;

      // Logout
      const response = await request(app)
        .post('/api/auth/logout')
        .set('Authorization', `Bearer ${accessToken}`)
        .send({ refreshToken });

      expect(response.status).toBe(200);
      expect(response.body.success).toBe(true);
    });

    test('should reject logout without token', async () => {
      const response = await request(app)
        .post('/api/auth/logout')
        .send({ refreshToken: 'some-token' });

      expect(response.status).toBe(401);
    });
  });
});

