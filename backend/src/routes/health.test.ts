import { describe, it, expect, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';

describe('GET /api/health', () => {
  afterAll(async () => {
    await prisma.$disconnect();
  });

  it('returns HTTP 200 and verifies live PostgreSQL database connection', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('devtrack-backend');
    expect(response.body.database).toBe('connected');
    expect(typeof response.body.timestamp).toBe('string');
  }, 15000);
});