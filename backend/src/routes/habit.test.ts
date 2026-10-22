import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import request from 'supertest';
import app from '../app';
import { prisma } from '../config/db';
import {
  addCalendarDays,
  formatDateStr,
  getDateRangeEndingAt,
  getDatesInMonth,
  getTodayForTimezone,
  getWeekdayIndex,
  isValidCalendarDate,
  isValidYearMonth,
  isWithinAllowedTodayWindow,
  normalizeScheduledDays,
} from '../utils/date';
import {
  calculateCurrentStreak,
  calculateLongestStreak,
} from '../services/habit.service';

describe('Phase 2 & 3 Habit Engine, Calendar, Archiving, Streaks & Analytics (/api/habits)', () => {
  let tokenA = '';
  let tokenB = '';
  let userAEmail = '';
  let userBEmail = '';
  let habitIdA = '';
  const todayStr = formatDateStr(new Date());
  const currentMonthStr = todayStr.slice(0, 7);
  const todayWeekday = getWeekdayIndex(todayStr);

  beforeAll(async () => {
    for (let attempt = 1; attempt <= 3; attempt++) {
      try {
        await prisma.$connect();
        await prisma.$queryRaw`SELECT 1`;
        break;
      } catch (err) {
        if (attempt === 3) throw err;
        await prisma.$disconnect().catch(() => {});
        await new Promise((r) => setTimeout(r, 2500));
      }
    }

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
  }, 60000);

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
  }, 60000);

  it('1. handles empty history and unauthenticated or invalid requests cleanly', async () => {
    const unauthList = await request(app).get('/api/habits');
    expect(unauthList.status).toBe(401);

    const unauthAnalytics = await request(app).get('/api/habits/analytics');
    expect(unauthAnalytics.status).toBe(401);

    const unauthCalendar = await request(app).get('/api/habits/calendar');
    expect(unauthCalendar.status).toBe(401);

    const badDateRes = await request(app)
      .get('/api/habits?date=2026-02-31')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(badDateRes.status).toBe(400);

    const badMonthRes = await request(app)
      .get('/api/habits/calendar?month=2026-13')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(badMonthRes.status).toBe(400);

    const badTzRes = await request(app)
      .get('/api/habits/analytics?tzOffset=9999')
      .set('Authorization', `Bearer ${tokenA}`);
    expect(badTzRes.status).toBe(400);

    const emptyAnalyticsRes = await request(app)
      .get(`/api/habits/analytics?date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(emptyAnalyticsRes.status).toBe(200);
    expect(emptyAnalyticsRes.body.analytics.todayScheduledCount).toBe(0);
    expect(emptyAnalyticsRes.body.analytics.todayCompletionPercentage).toBe(0);
    expect(emptyAnalyticsRes.body.analytics.trend7Days).toHaveLength(7);
    expect(emptyAnalyticsRes.body.analytics.trend30Days).toHaveLength(30);
  });

  it('2. validates habit creation, weekday schedule rules, completion undo, and re-completion', async () => {
    const badSchedule1 = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Bad Schedule', scheduledDays: [] });
    expect(badSchedule1.status).toBe(400);

    const badSchedule2 = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ title: 'Bad Schedule 2', scheduledDays: [0, 7] });
    expect(badSchedule2.status).toBe(400);

    const unscheduledWeekday = (todayWeekday + 1) % 7;
    const createRes = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'User A Scheduled Practice',
        category: 'DSA',
        scheduledDays: [unscheduledWeekday],
        verificationType: 'MANUAL_PROOF',
      });
    expect(createRes.status).toBe(201);
    habitIdA = createRes.body.habit.id;
    expect(createRes.body.habit.scheduledDays).toEqual([unscheduledWeekday]);
    expect(createRes.body.habit.targetDaysPerWeek).toBe(1);

    // Attempting to complete on an unscheduled weekday -> 400
    const unscheduledToggle = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr, note: 'Trying on unscheduled day' });
    expect(unscheduledToggle.status).toBe(400);

    // Update schedule via PATCH /api/habits/:id to include todayWeekday
    const patchRes = await request(app)
      .patch(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'User A Daily DSA Practice',
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
      });
    expect(patchRes.status).toBe(200);
    expect(patchRes.body.habit.targetDaysPerWeek).toBe(7);

    // Complete today with valid proof -> completed: true, currentStreak: 1, longestStreak: 1
    const complete1 = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr, note: 'Solved Binary Search & Trees' });
    expect(complete1.status).toBe(200);
    expect(complete1.body.completed).toBe(true);
    expect(complete1.body.currentStreak).toBe(1);
    expect(complete1.body.longestStreak).toBe(1);

    // Safe Undo
    const undoRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr });
    expect(undoRes.status).toBe(200);
    expect(undoRes.body.completed).toBe(false);
    expect(undoRes.body.currentStreak).toBe(0);

    // Re-completion
    const recompleteRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr, note: 'Re-verified Binary Search & Trees' });
    expect(recompleteRes.status).toBe(200);
    expect(recompleteRes.body.completed).toBe(true);
    expect(recompleteRes.body.currentStreak).toBe(1);
  });

  it('3. verifies monthly habit calendar endpoint, archiving/restoring while preserving history, and user isolation', async () => {
    // 1. Fetch monthly calendar for User A on currentMonthStr
    const calRes = await request(app)
      .get(`/api/habits/calendar?month=${currentMonthStr}&date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(calRes.status).toBe(200);
    expect(calRes.body.calendar.month).toBe(currentMonthStr);
    expect(calRes.body.calendar.summary.totalCompletedLogsInMonth).toBe(1);

    const todayCell = calRes.body.calendar.days.find(
      (d: { date: string }) => d.date === todayStr
    );
    expect(todayCell).toBeDefined();
    expect(todayCell.status).toBe('completed');
    expect(todayCell.completedCount).toBe(1);

    // 2. Future month calendar cells must be marked 'future'
    const futureCal = await request(app)
      .get(`/api/habits/calendar?month=2099-01&date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(futureCal.status).toBe(200);
    expect(
      futureCal.body.calendar.days.every((d: { status: string }) => d.status === 'future')
    ).toBe(true);

    // 3. Past month before habit creation must be marked 'before_created'
    const pastCal = await request(app)
      .get(`/api/habits/calendar?month=2020-01&date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(pastCal.status).toBe(200);
    expect(
      pastCal.body.calendar.days.every((d: { status: string }) => d.status === 'before_created')
    ).toBe(true);

    // 4. User B cannot query User A's habitId on /api/habits/calendar (404)
    const crossCal = await request(app)
      .get(`/api/habits/calendar?month=${currentMonthStr}&date=${todayStr}&habitId=${habitIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(crossCal.status).toBe(404);

    // 5. Archive habitIdA -> hidden from default active list, visible with includeArchived=true, and historical logs preserved!
    const archiveRes = await request(app)
      .patch(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isArchived: true });
    expect(archiveRes.status).toBe(200);
    expect(archiveRes.body.habit.isArchived).toBe(true);

    const activeList = await request(app)
      .get(`/api/habits?date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(activeList.body.habits).toHaveLength(0);
    // Total completed scheduled habits across history is still preserved (1)!
    expect(activeList.body.analytics.totalCompletedScheduledHabits).toBe(1);

    const archivedList = await request(app)
      .get(`/api/habits?date=${todayStr}&includeArchived=true`)
      .set('Authorization', `Bearer ${tokenA}`);
    expect(archivedList.body.habits).toHaveLength(1);
    expect(archivedList.body.habits[0].isArchived).toBe(true);
    expect(archivedList.body.habits[0].longestStreak).toBe(1);

    // Restore habitIdA back to active
    const restoreRes = await request(app)
      .patch(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ isArchived: false });
    expect(restoreRes.status).toBe(200);
    expect(restoreRes.body.habit.isArchived).toBe(false);
  });

  it('4. enforces two-user isolation across habits, PATCH, toggle, verify, delete, and analytics', async () => {
    const listB = await request(app)
      .get(`/api/habits?date=${todayStr}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(listB.status).toBe(200);
    expect(listB.body.habits).toHaveLength(0);
    expect(listB.body.analytics.todayScheduledCount).toBe(0);
    expect(listB.body.analytics.totalCompletedScheduledHabits).toBe(0);

    const patchB = await request(app)
      .patch(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ title: 'Hacked Title' });
    expect(patchB.status).toBe(404);

    const toggleB = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ date: todayStr, today: todayStr, note: 'Unauthorized toggle' });
    expect(toggleB.status).toBe(404);

    const verifyB = await request(app)
      .post(`/api/habits/${habitIdA}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenB}`)
      .send({ today: todayStr });
    expect(verifyB.status).toBe(404);

    const deleteB = await request(app)
      .delete(`/api/habits/${habitIdA}`)
      .set('Authorization', `Bearer ${tokenB}`);
    expect(deleteB.status).toBe(404);
  });

  it('5. verifies LeetCode auto-sync, idempotent duplicate completions, and anti-cheat locks', async () => {
    const backdateRes = await request(app)
      .post(`/api/habits/${habitIdA}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: '2020-01-01', today: todayStr, note: 'Backdate try' });
    expect(backdateRes.status).toBe(403);

    const lcCreate = await request(app)
      .post('/api/habits')
      .set('Authorization', `Bearer ${tokenA}`)
      .send({
        title: 'LeetCode Daily 2',
        category: 'DSA',
        verificationType: 'LEETCODE',
        leetcodeUsername: 'mock_lc_2',
        dailyTargetCount: 2,
      });
    expect(lcCreate.status).toBe(201);
    const lcId = lcCreate.body.habit.id;

    const manualOnLc = await request(app)
      .post(`/api/habits/${lcId}/toggle`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ date: todayStr, today: todayStr, note: 'Manual bypass try' });
    expect(manualOnLc.status).toBe(403);

    const sync1 = await request(app)
      .post(`/api/habits/${lcId}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ today: todayStr, timezoneOffsetMinutes: 330 });
    expect(sync1.status).toBe(200);
    expect(sync1.body.completed).toBe(true);
    expect(sync1.body.currentStreak).toBe(1);

    const sync2 = await request(app)
      .post(`/api/habits/${lcId}/verify-leetcode`)
      .set('Authorization', `Bearer ${tokenA}`)
      .send({ today: todayStr, timezoneOffsetMinutes: 330 });
    expect(sync2.status).toBe(200);
    expect(sync2.body.completed).toBe(true);
    expect(sync2.body.currentStreak).toBe(1);
  });

  it('6. unit-tests daily streaks, selected-weekday schedules, unscheduled days, missed-day recovery, and boundaries', () => {
    const dailySet = new Set(['2026-10-17', '2026-10-18', '2026-10-19']);
    expect(calculateCurrentStreak(dailySet, '2026-10-19')).toBe(3);
    expect(calculateLongestStreak(dailySet, '2026-10-19')).toBe(3);

    const mwfSchedule = [1, 3, 5];
    const mwfLogs = new Set(['2026-10-12', '2026-10-14', '2026-10-16']);
    expect(calculateCurrentStreak(mwfLogs, '2026-10-15', mwfSchedule)).toBe(2);
    expect(calculateCurrentStreak(mwfLogs, '2026-10-19', mwfSchedule)).toBe(3);
    expect(calculateLongestStreak(mwfLogs, '2026-10-19', mwfSchedule)).toBe(3);

    expect(calculateCurrentStreak(mwfLogs, '2026-10-21', mwfSchedule)).toBe(0);
    expect(calculateLongestStreak(mwfLogs, '2026-10-21', mwfSchedule)).toBe(3);

    const mwfRecovered = new Set(['2026-10-12', '2026-10-14', '2026-10-16', '2026-10-21']);
    expect(calculateCurrentStreak(mwfRecovered, '2026-10-21', mwfSchedule)).toBe(1);
    expect(calculateLongestStreak(mwfRecovered, '2026-10-21', mwfSchedule)).toBe(3);

    const yearBoundaryLogs = new Set([
      '2025-12-30',
      '2025-12-31',
      '2026-01-01',
      '2026-01-02',
    ]);
    expect(calculateCurrentStreak(yearBoundaryLogs, '2026-01-02')).toBe(4);
    expect(calculateLongestStreak(yearBoundaryLogs, '2026-01-02')).toBe(4);

    expect(addCalendarDays('2026-02-28', 1)).toBe('2026-03-01');
    expect(getDateRangeEndingAt('2026-03-02', 3)).toEqual([
      '2026-02-28',
      '2026-03-01',
      '2026-03-02',
    ]);
    expect(isValidYearMonth('2026-10')).toBe(true);
    expect(isValidYearMonth('2026-00')).toBe(false);
    expect(getDatesInMonth('2026-02')).toHaveLength(28);
    expect(getDatesInMonth('2024-02')).toHaveLength(29);

    const refTimestamp = new Date('2026-10-20T20:00:00.000Z').getTime();
    expect(getTodayForTimezone(0, refTimestamp)).toBe('2026-10-20');
    expect(getTodayForTimezone(330, refTimestamp)).toBe('2026-10-21');
    expect(getTodayForTimezone(-420, refTimestamp)).toBe('2026-10-20');

    expect(isWithinAllowedTodayWindow('2026-10-20', refTimestamp)).toBe(true);
    expect(isWithinAllowedTodayWindow('2026-10-21', refTimestamp)).toBe(true);
    expect(isWithinAllowedTodayWindow('2026-10-18', refTimestamp)).toBe(false);

    expect(normalizeScheduledDays([5, 1, 3, 1])).toEqual([1, 3, 5]);
    expect(isValidCalendarDate('2026-02-29')).toBe(false);
  });
});