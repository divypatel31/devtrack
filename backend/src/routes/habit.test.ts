import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';

describe('Habits & Streak API (/api/habits)', () => {
  let createdHabitId = '';

  beforeAll(async () => {
    await prisma.$connect();
  }, 30000);

  afterAll(async () => {
    if (createdHabitId) {
      await prisma.habit.deleteMany({ where: { id: createdHabitId } });
    }
    await prisma.$disconnect();
  }, 30000);

  it('rejects creating a habit with an empty title (400)', async () => {
    const res = await request(app).post('/api/habits').send({ title: '   ' });
    expect(res.status).toBe(400);
    expect(res.body.error).toBeDefined();
  });

  it('creates a habit, logs a 3-day streak, verifies weekly progress, and cleans up', async () => {
    // 1. Create a new habit
    const createRes = await request(app).post('/api/habits').send({
      title: 'Solve 1 LeetCode Problem [Test]',
      category: 'DSA',
      targetDaysPerWeek: 5,
    });

    expect(createRes.status).toBe(201);
    expect(createRes.body.habit.id).toBeDefined();
    createdHabitId = createRes.body.habit.id;

    // 2. Toggle 3 consecutive days: Oct 14, Oct 15, Oct 16
    const days = ['2026-10-14', '2026-10-15', '2026-10-16'];
    for (const date of days) {
      const toggleRes = await request(app)
        .post(`/api/habits/${createdHabitId}/toggle`)
        .send({ date });
      expect(toggleRes.status).toBe(200);
      expect(toggleRes.body.completed).toBe(true);
    }

    // 3. Fetch habits for 2026-10-16 and verify 3-day streak
    const listRes = await request(app).get('/api/habits?date=2026-10-16');
    expect(listRes.status).toBe(200);

    const testHabit = listRes.body.habits.find((h: { id: string }) => h.id === createdHabitId);
    expect(testHabit).toBeDefined();
    expect(testHabit.completedToday).toBe(true);
    expect(testHabit.currentStreak).toBe(3);
    expect(testHabit.weeklyProgress).toHaveLength(7);

    // 4. Toggle 2026-10-16 again to uncheck today -> streak should remain 2 (from Oct 14 & 15)
    const uncheckRes = await request(app)
      .post(`/api/habits/${createdHabitId}/toggle`)
      .send({ date: '2026-10-16' });
    expect(uncheckRes.status).toBe(200);
    expect(uncheckRes.body.completed).toBe(false);

    const listAfterUncheck = await request(app).get('/api/habits?date=2026-10-16');
    const updatedHabit = listAfterUncheck.body.habits.find(
      (h: { id: string }) => h.id === createdHabitId
    );
    expect(updatedHabit.completedToday).toBe(false);
    expect(updatedHabit.currentStreak).toBe(2);

    // 5. Delete the test habit
    const deleteRes = await request(app).delete(`/api/habits/${createdHabitId}`);
    expect(deleteRes.status).toBe(200);
    expect(deleteRes.body.deleted).toBe(true);
    createdHabitId = '';
  }, 60000);
});