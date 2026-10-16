import { describe, it, expect } from 'vitest';
import request from 'supertest';
import app from '../app';

describe('GET /api/health', () => {
  it('returns HTTP 200 and valid service status payload', async () => {
    const response = await request(app).get('/api/health');

    expect(response.status).toBe(200);
    expect(response.body.status).toBe('ok');
    expect(response.body.service).toBe('devtrack-backend');
    expect(typeof response.body.timestamp).toBe('string');
  });
});
