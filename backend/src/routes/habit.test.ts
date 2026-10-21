import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import {
  formatDateStr,
  isValidCalendarDate,
  isWithinAllowedTodayWindow,
} from '../utils/date';
import { calculateCurrentStreak } from '../services/habit.service';

describe('Habits, Cross-User Isolation, Streak Edge Cases & Anti-Cheat API (/api/habits)', () => {
  let tokenA = '';
  let tokenB = '';
  let userAEmail = '';
  let userBEmail = '';
  let habitIdA = '';
  const todayStr = formatDateStr(new Date());

  beforeAll(async () => {
    await prisma.$connect();

    const tag = Date.now();
    userAEmail = `user_a_${tag}@devtrack.local`;
    userBEmail = `user_b_${tag}@devtrack.local`;

    const regA = await request(app).post('/api/auth/register').send({
      email: userAEmail,
      name: 'User A',
      password: 'Password123!',
    });
    tokenA = regA.body.token;

    const regB = await request(app).post('/api/auth/register').send({
      email: userBEmail,
      name: 'User B',
      password: 'Password123!',
    });
    tokenB = regB.body.token;
  }, 30000);

  afterAll(async () => {
    await prisma.user.deleteMany({
      where: {
        OR: [
          { email: { startsWith: 'user_a_' } },
          { email: { startsWith: 'user_b_' } },
        ],
      },
    });
    await prisma.$disconnect();
  }, 30000);

  it('rejects unauthenticated habit requests (401)', async () => {
    const res = await request(app).get('/api/habits');
    expect(res.status).toBe(401);
  });

  it('allows User A to create a habit and rejects invalid titles', async () => {
    const emptyRes = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: '   ' });
    expect(emptyRes.status).toBe(400);

    const res = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'User A DSA Practice',
        category: 'DSA',
        verificationType: 'MANUAL_PROOF',
      });
    expect(res.status).toBe(201);
    habitIdA = res.body.habit.id;
    expect(res.body.habit.userId).toBeDefined();
  });

  it('enforces cross-user isolation: User B cannot read, toggle, verify, or delete User A\'s habit (404)', async () => {
    const listRes = await request(app)
      .get('/api/habits')
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listRes.status).toBe(200);
    expect(listRes.body.habits.some((h: { id: string }) => h.id === habitIdA)).toBe(false);

    const toggleRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ date: todayStr, today: todayStr, note: 'Unauthorized tamper attempt' });
    expect(toggleRes.status).toBe(404);

    const verifyRes = await request(app)
      .post(`/api/habits/${habitIdA}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ today: todayStr });
    expect(verifyRes.status).toBe(404);

    const deleteRes = await request(app)
      .delete(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteRes.status).toBe(404);
  });

  it('enforces anti-cheat past date lock, proof validation, and duplicate completion toggle behavior', async () => {
    // 1. Backdate attempt (date !== today) -> 403
    const backdateRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: '2020-01-01', today: todayStr, note: 'Backdate try' });
    expect(backdateRes.status).toBe(403);

    // 2. Spoofed `today` outside real-world server clock window -> 403
    const spoofedTodayRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: '2020-01-01', today: '2020-01-01', note: 'Spoofed clock try' });
    expect(spoofedTodayRes.status).toBe(403);

    // 3. Invalid short proof (< 4 chars) -> 400
    const noProofRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr, note: 'abc' });
    expect(noProofRes.status).toBe(400);

    // 4. First valid completion -> completed: true (200)
    const validRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr, note: 'Solved Two Sum & Valid Parentheses' });
    expect(validRes.status).toBe(200);
    expect(validRes.body.completed).toBe(true);

    // 5. Second toggle on same day unchecks completion cleanly without duplicate rows -> completed: false (200)
    const uncheckRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr });
    expect(uncheckRes.status).toBe(200);
    expect(uncheckRes.body.completed).toBe(false);
  });

  it('verifies LeetCode success, idempotent duplicate syncs, and LeetCode failure edge cases', async () => {
    // 1. Calling verify-leetcode on a MANUAL_PROOF habit -> 400
    const wrongTypeRes = await request(app)
      .post(`/api/habits/${habitIdA}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ today: todayStr });
    expect(wrongTypeRes.status).toBe(400);

    // 2. Create LEETCODE habit where user solved 0/2 today -> completed: false
    const lcIncompleteCreate = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'LeetCode Incomplete Target',
        category: 'DSA',
        verificationType: 'LEETCODE',
        leetcodeUsername: 'mock_lc_0',
        dailyTargetCount: 2,
      });
    expect(lcIncompleteCreate.status).toBe(201);
    const lcIncompleteId = lcIncompleteCreate.body.habit.id;

    const incompleteVerify = await request(app)
      .post(`/api/habits/${lcIncompleteId}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ today: todayStr });
    expect(incompleteVerify.status).toBe(200);
    expect(incompleteVerify.body.completed).toBe(false);
    expect(incompleteVerify.body.solvedTodayCount).toBe(0);

    // 3. Create LEETCODE habit where upstream API errors -> 400
    const lcErrorCreate = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'LeetCode Error Target',
        category: 'DSA',
        verificationType: 'LEETCODE',
        leetcodeUsername: 'mock_lc_error',
        dailyTargetCount: 1,
      });
    const lcErrorId = lcErrorCreate.body.habit.id;

    const errVerify = await request(app)
      .post(`/api/habits/${lcErrorId}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ today: todayStr });
    expect(errVerify.status).toBe(400);

    // 4. Create LEETCODE habit with 2/2 solved -> completed: true & idempotent on repeat sync
    const lcCreate = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'LeetCode Daily Target',
        category: 'DSA',
        verificationType: 'LEETCODE',
        leetcodeUsername: 'mock_lc_2',
        dailyTargetCount: 2,
      });
    expect(lcCreate.status).toBe(201);
    const lcId = lcCreate.body.habit.id;

    // Manual toggle on LeetCode goal -> 403
    const manualToggle = await request(app)
      .post(`/api/habits/${lcId}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr, note: 'Trying manual check' });
    expect(manualToggle.status).toBe(403);

    // First verify -> 200 completed: true
    const verifyRes1 = await request(app)
      .post(`/api/habits/${lcId}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ today: todayStr });
    expect(verifyRes1.status).toBe(200);
    expect(verifyRes1.body.completed).toBe(true);
    expect(verifyRes1.body.solvedTodayCount).toBe(2);

    // Second duplicate verify on same day -> 200 (idempotent upsert)
    const verifyRes2 = await request(app)
      .post(`/api/habits/${lcId}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ today: todayStr });
    expect(verifyRes2.status).toBe(200);
    expect(verifyRes2.body.completed).toBe(true);

    // Delete habit -> 200, and second delete -> 404
    const del1 = await request(app)
      .delete(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(del1.status).toBe(200);

    const del2 = await request(app)
      .delete(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(del2.status).toBe(404);
  });

  it('validates streak calculation edge cases, invalid calendar dates, and timezone boundaries', async () => {
    // Calendar date validation
    expect(isValidCalendarDate('2026-10-19')).toBe(true);
    expect(isValidCalendarDate('2026-02-31')).toBe(false);
    expect(isValidCalendarDate('2026-99-99')).toBe(false);
    expect(isValidCalendarDate('not-a-date')).toBe(false);

    // API rejects impossible calendar dates (e.g., 2026-02-31) with 400 instead of crashing with 500
    const badDateRes = await request(app)
      .get('/api/habits?date=2026-02-31')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(badDateRes.status).toBe(400);

    // Timezone boundary validation (-12h to +14h around reference UTC timestamp)
    const refUtc = new Date('2026-10-19T22:00:00.000Z').getTime();
    // At 22:00 UTC on Oct 19, UTC+14 (Kiritimati) is already Oct 20 (12:00), and UTC is Oct 19
    expect(isWithinAllowedTodayWindow('2026-10-19', refUtc)).toBe(true);
    expect(isWithinAllowedTodayWindow('2026-10-20', refUtc)).toBe(true);
    expect(isWithinAllowedTodayWindow('2026-10-17', refUtc)).toBe(false);

    // Streak edge cases:
    // 1. Consecutive 3 days including today
    const streak3 = calculateCurrentStreak(
      new Set(['2026-10-17', '2026-10-18', '2026-10-19']),
      '2026-10-19'
    );
    expect(streak3).toBe(3);

    // 2. Yesterday completed, today not yet completed -> grace period keeps streak at 2
    const graceStreak = calculateCurrentStreak(
      new Set(['2026-10-17', '2026-10-18']),
      '2026-10-19'
    );
    expect(graceStreak).toBe(2);

    // 3. Gap yesterday (completed 2 days ago, missed yesterday and today) -> streak resets to 0
    const brokenStreak = calculateCurrentStreak(
      new Set(['2026-10-16', '2026-10-17']),
      '2026-10-19'
    );
    expect(brokenStreak).toBe(0);
  });
});