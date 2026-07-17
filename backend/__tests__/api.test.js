const request = require('supertest');
const app = require('../app');
const { sequelize } = require('../config/db');

// Mock the S3 service to avoid S3rver socket binding conflicts during Jest runs
jest.mock('../services/s3Service', () => ({
  startS3rver: jest.fn().mockResolvedValue(true),
  uploadToS3: jest.fn().mockResolvedValue('mock-s3-key'),
  getPresignedUrl: jest.fn().mockResolvedValue('http://mockip:9000/media-locker-bucket/mock-key'),
}));

beforeAll(async () => {
  // Sync the SQLite DB before running tests
  await sequelize.sync({ force: true });
});

afterAll(async () => {
  // Close DB connection after tests complete
  await sequelize.close();
});

describe('Paid Media Locker API Tests', () => {
  let userToken;
  let testUsername = `user_${Date.now()}`;

  describe('Authentication Endpoints', () => {
    test('POST /api/auth/register - Should register a new user with 1000 coins signup bonus', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: testUsername,
          password: 'Password123'
        });

      expect(res.statusCode).toBe(201);
      expect(res.body).toHaveProperty('token');
      expect(res.body.user).toHaveProperty('username', testUsername);
      expect(res.body.user).toHaveProperty('walletBalance', 1000);
      userToken = res.body.token;
    });

    test('POST /api/auth/register - Should fail when username already exists', async () => {
      const res = await request(app)
        .post('/api/auth/register')
        .send({
          username: testUsername,
          password: 'Password123'
        });

      expect(res.statusCode).toBe(400);
      expect(res.body).toHaveProperty('error');
    });

    test('POST /api/auth/login - Should successfully log in user and return token', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'Password123'
        });

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('token');
    });

    test('POST /api/auth/login - Should fail with wrong password', async () => {
      const res = await request(app)
        .post('/api/auth/login')
        .send({
          username: testUsername,
          password: 'WrongPassword'
        });

      expect(res.statusCode).toBe(401);
      expect(res.body).toHaveProperty('error');
    });

    test('GET /api/auth/me - Should fetch authenticated user profile', async () => {
      const res = await request(app)
        .get('/api/auth/me')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body.user).toHaveProperty('username', testUsername);
      expect(res.body.user).toHaveProperty('walletBalance', 1000);
    });
  });

  describe('Wallet Endpoints', () => {
    test('GET /api/wallet/history - Should retrieve wallet history and current balance', async () => {
      const res = await request(app)
        .get('/api/wallet/history')
        .set('Authorization', `Bearer ${userToken}`);

      expect(res.statusCode).toBe(200);
      expect(res.body).toHaveProperty('balance', 1000);
      expect(res.body).toHaveProperty('transactions');
      expect(res.body.transactions.length).toBeGreaterThan(0);
      expect(res.body.transactions[0]).toHaveProperty('type', 'SIGNUP_BONUS');
    });
  });
});
