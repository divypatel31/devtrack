import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';

describe('Habits, Anti-Cheat & LeetCode Verification API (/api/habits)', () => {
  const createdIds: string[] = [];

  beforeAll(async () => {
    await prisma.$connect();
  }, 30000);

  afterAll(async () => {
    if (createdIds.length > 0) {
      await prisma.habit.deleteMany({ where: { id: { in: createdIds } } });
    }
    await prisma.$disconnect();
  }, 30000);

  it('rejects creating a habit with an empty title (400)', async () => {
    const res = await request(app).post('/api/habits').send({ title: '   ' });
    expect(res.status).toBe(400);
  });

  it('enforces anti-cheat lock on past dates, requires proof for manual goals, and auto-verifies LeetCode goals', async () => {
    // 1. Create a MANUAL_PROOF habit
    const manualRes = await request(app).post('/api/habits').send({
      title: 'System Design Reading [Test]',
      category: 'System Design',
      verificationType: 'MANUAL_PROOF',
    });
    expect(manualRes.status).toBe(201);
    const manualId = manualRes.body.habit.id;
    createdIds.push(manualId);

    // 2. Anti-Cheat Check: Try to toggle a PAST date (2026-10-14 when today is 2026-10-17) -> Must fail with 403!
    const cheatRes = await request(app)
      .post(`/api/habits/${manualId}/toggle`)
      .send({ date: '2026-10-14', today: '2026-10-17', note: 'Trying to backdate' });
    expect(cheatRes.status).toBe(403);

    // 3. Proof Check: Try to toggle TODAY without proof note -> Must fail with 400!
    const noProofRes = await request(app)
      .post(`/api/habits/${manualId}/toggle`)
      .send({ date: '2026-10-17', today: '2026-10-17', note: '' });
    expect(noProofRes.status).toBe(400);

    // 4. Valid Proof on TODAY -> Succeeds (200)
    const validProofRes = await request(app)
      .post(`/api/habits/${manualId}/toggle`)
      .send({
        date: '2026-10-17',
        today: '2026-10-17',
        note: 'Read Ch 4 Distributed Cache',
      });
    expect(validProofRes.status).toBe(200);
    expect(validProofRes.body.completed).toBe(true);

    // 5. Create a LEETCODE Auto-Verified habit requiring 2 problems/day
    const lcCreateRes = await request(app).post('/api/habits').send({
      title: 'Solve 2 LeetCode Problems [Test]',
      category: 'DSA',
      verificationType: 'LEETCODE',
      leetcodeUsername: 'mock_lc_2',
      dailyTargetCount: 2,
    });
    expect(lcCreateRes.status).toBe(201);
    const lcId = lcCreateRes.body.habit.id;
    createdIds.push(lcId);

    // 6. Anti-Cheat: Manual toggle on a LEETCODE habit must be blocked (403)!
    const manualClickOnLc = await request(app)
      .post(`/api/habits/${lcId}/toggle`)
      .send({ date: '2026-10-17', today: '2026-10-17', note: 'Fake click' });
    expect(manualClickOnLc.status).toBe(403);

    // 7. Auto-Verify via /verify-leetcode endpoint -> Automatically completes!
    const verifyRes = await request(app)
      .post(`/api/habits/${lcId}/verify-leetcode`)
      .send({ today: '2026-10-17' });
    expect(verifyRes.status).toBe(200);
    expect(verifyRes.body.completed).toBe(true);
    expect(verifyRes.body.solvedTodayCount).toBe(2);
  }, 60000);
});