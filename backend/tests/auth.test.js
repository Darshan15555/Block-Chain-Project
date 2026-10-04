const request = require('supertest');
const express = require('express');

jest.mock('../models/User', () => ({
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
}));

jest.mock('../middleware/web3Service', () => ({
  getGanacheAccounts: jest.fn().mockResolvedValue([
    '0x1111111111111111111111111111111111111111',
    '0x2222222222222222222222222222222222222222',
  ]),
  getWeb3Status: jest.fn().mockReturnValue({
    connected: true,
    contractDeployed: true,
    authorityAccount: '0x1111111111111111111111111111111111111111',
    ganacheUrl: 'http://127.0.0.1:7545',
  }),
}));

const User = require('../models/User');
const web3Service = require('../middleware/web3Service');
const authRoutes = require('../routes/authRoutes');

describe('Auth Routes', () => {
  const app = express();
  app.use(express.json());
  app.use('/api/auth', authRoutes);

  beforeEach(() => {
    jest.clearAllMocks();
  });

  test('POST /api/auth/login returns 400 when credentials are missing', async () => {
    const res = await request(app).post('/api/auth/login').send({ username: '' });
    expect(res.status).toBe(400);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login returns 401 for invalid credentials', async () => {
    User.findOne.mockResolvedValue(null);

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'authority_admin', password: 'wrong', role: 'authority' });

    expect(res.status).toBe(401);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login returns 403 for role mismatch', async () => {
    User.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      name: 'Central Authority',
      username: 'authority_admin',
      role: 'authority',
      walletAddress: '0x123',
      comparePassword: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'authority_admin', password: 'Authority@123', role: 'contractor' });

    expect(res.status).toBe(403);
    expect(res.body.success).toBe(false);
  });

  test('POST /api/auth/login returns token and user for valid credentials', async () => {
    User.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      name: 'Central Authority',
      username: 'authority_admin',
      role: 'authority',
      walletAddress: '0x123',
      comparePassword: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ username: 'authority_admin', password: 'Authority@123', role: 'authority' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('authority');
  });

  test('POST /api/auth/login supports email and password without role', async () => {
    User.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439011',
      name: 'Central Authority',
      username: 'authority_admin',
      email: 'authority@blockfund.gov',
      role: 'authority',
      walletAddress: '0x123',
      comparePassword: jest.fn().mockResolvedValue(true),
    });

    const res = await request(app)
      .post('/api/auth/login')
      .send({ email: 'authority@blockfund.gov', password: 'Authority@123' });

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('authority');
  });

  test('POST /api/auth/public-viewer returns public access token', async () => {
    User.findOne.mockResolvedValue({
      _id: '507f1f77bcf86cd799439098',
      name: 'Public Viewer',
      username: 'public_user',
      role: 'public',
      walletAddress: null,
    });

    const res = await request(app).post('/api/auth/public-viewer');
    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.token).toBeTruthy();
    expect(res.body.user.role).toBe('public');
  });

  test('POST /api/auth/signup creates account', async () => {
    User.findOne.mockResolvedValue(null);
    User.create.mockResolvedValue({
      _id: '507f1f77bcf86cd799439099',
      name: 'Contractor One',
      username: 'c1',
      role: 'contractor',
      walletAddress: '0x1234567890123456789012345678901234567890',
    });

    const res = await request(app)
      .post('/api/auth/signup')
      .send({
        name: 'Contractor One',
        username: 'c1',
        password: 'Secret@123',
        role: 'contractor',
        walletAddress: '0x1234567890123456789012345678901234567890',
      });

    expect(res.status).toBe(201);
    expect(res.body.success).toBe(true);
    expect(res.body.user.username).toBe('c1');
    expect(res.body.token).toBeTruthy();
  });

  test('GET /api/auth/wallet-options returns contractor-safe wallet list', async () => {
    const res = await request(app).get('/api/auth/wallet-options');

    expect(res.status).toBe(200);
    expect(res.body.success).toBe(true);
    expect(res.body.wallets).toEqual(['0x2222222222222222222222222222222222222222']);
    expect(web3Service.getGanacheAccounts).toHaveBeenCalled();
  });
});
