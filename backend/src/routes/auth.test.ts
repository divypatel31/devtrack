import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';

describe('Authentication & User Isolation API (/api/auth)', () => {
  const testEmail = `sec_test_${Date.now()}@devtrack.local`;
  let userToken = '';

  beforeAll(async () => {
    await prisma.$connect();
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({ where: { email: { contains: 'sec_test_' } } });
    await prisma.$disconnect();
  }, 30000);

  it('registers a new user successfully (201)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      name: 'Security Auditor',
      password: 'SecurePassword123!',
    });
    expect(res.status).toBe(201);
    expect(res.body.token).toBeDefined();
    expect(res.body.user.email).toBe(testEmail);
    userToken = res.body.token;
  });

  it('rejects duplicate email registration (409)', async () => {
    const res = await request(app).post('/api/auth/register').send({
      email: testEmail,
      name: 'Duplicate Auditor',
      password: 'SecurePassword123!',
    });
    expect(res.status).toBe(409);
  });

  it('rejects weak passwords or invalid email formats (400)', async () => {
    const weakRes = await request(app).post('/api/auth/register').send({
      email: 'bad@devtrack.local',
      name: 'Weak',
      password: 'short',
    });
    expect(weakRes.status).toBe(400);

    const badEmailRes = await request(app).post('/api/auth/register').send({
      email: 'not-an-email',
      name: 'Bad Email',
      password: 'SecurePassword123!',
    });
    expect(badEmailRes.status).toBe(400);
  });

  it('logs in with correct credentials (200)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'SecurePassword123!',
    });
    expect(res.status).toBe(200);
    expect(res.body.token).toBeDefined();
  });

  it('rejects invalid login credentials with generic error (401)', async () => {
    const res = await request(app).post('/api/auth/login').send({
      email: testEmail,
      password: 'WrongPassword999!',
    });
    expect(res.status).toBe(401);
    expect(res.body.error).toBe('Invalid email or password.');
  });

  it('protects /api/auth/me against missing or invalid tokens (401)', async () => {
    const noTokenRes = await request(app).get('/api/auth/me');
    expect(noTokenRes.status).toBe(401);

    const badTokenRes = await request(app)
      .get('/api/auth/me')
      .set('Authorization', 'Bearer invalid.jwt.token');
    expect(badTokenRes.status).toBe(401);
  });

  it('returns user profile with valid token (200)', async () => {
    const res = await request(app)
      .get('/api/auth/me')
      .set('Authorization', `Bearer ${userToken}`);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(testEmail);
  });
});