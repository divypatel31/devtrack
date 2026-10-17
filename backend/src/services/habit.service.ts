import { prisma } from '../config/db';
import { verifyLeetCodeSubmissionsForDate } from './leetcode.service';

export interface CreateHabitInput {
  title: string;
  category?: string;
  targetDaysPerWeek?: number;
  verificationType?: 'MANUAL_PROOF' | 'LEETCODE';
  leetcodeUsername?: string;
  dailyTargetCount?: number;
}

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

export function getLast7Days(referenceDateStr?: string): string[] {
  const baseDate = referenceDateStr
    ? new Date(`${referenceDateStr}T00:00:00.000Z`)
    : new Date();
  const days: string[] = [];

  for (let i = 6; i >= 0; i--) {
    const d = new Date(baseDate);
    d.setUTCDate(baseDate.getUTCDate() - i);
    days.push(formatDateStr(d));
  }
  return days;
}

export function calculateCurrentStreak(
  completedDates: Set<string>,
  todayStr: string
): number {
  let streak = 0;
  const cursor = new Date(`${todayStr}T00:00:00.000Z`);

  if (!completedDates.has(formatDateStr(cursor))) {
    cursor.setUTCDate(cursor.getUTCDate() - 1);
    if (!completedDates.has(formatDateStr(cursor))) {
      return 0;
    }
  }

  while (completedDates.has(formatDateStr(cursor))) {
    streak++;
    cursor.setUTCDate(cursor.getUTCDate() - 1);
  }

  return streak;
}

export async function getAllHabitsWithStats(todayStr?: string) {
  const currentDay = todayStr || formatDateStr(new Date());
  const last7Days = getLast7Days(currentDay);

  const habits = await prisma.habit.findMany({
    where: { isArchived: false },
    include: {
      logs: {
        orderBy: { completedDate: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  return habits.map((habit) => {
    const logMap = new Map(habit.logs.map((log) => [log.completedDate, log]));
    const completedSet = new Set(habit.logs.map((log) => log.completedDate));
    const currentStreak = calculateCurrentStreak(completedSet, currentDay);
    const todayLog = logMap.get(currentDay);
    const completedToday = Boolean(todayLog);

    const weeklyProgress = last7Days.map((date) => ({
      date,
      completed: completedSet.has(date),
      note: logMap.get(date)?.note || null,
      verifiedCount: logMap.get(date)?.verifiedCount || 0,
    }));

    return {
      id: habit.id,
      title: habit.title,
      category: habit.category,
      targetDaysPerWeek: habit.targetDaysPerWeek,
      verificationType: habit.verificationType,
      leetcodeUsername: habit.leetcodeUsername,
      dailyTargetCount: habit.dailyTargetCount,
      createdAt: habit.createdAt,
      completedToday,
      todayNote: todayLog?.note || null,
      todayVerifiedCount: todayLog?.verifiedCount || 0,
      currentStreak,
      weeklyProgress,
    };
  });
}

export async function createHabit(input: CreateHabitInput) {
  const verificationType =
    input.verificationType === 'LEETCODE' ? 'LEETCODE' : 'MANUAL_PROOF';

  if (verificationType === 'LEETCODE' && !input.leetcodeUsername?.trim()) {
    throw new AppError('LeetCode username is required for LeetCode auto-verified goals.', 400);
  }

  return prisma.habit.create({
    data: {
      title: input.title.trim(),
      category: input.category?.trim() || 'General',
      targetDaysPerWeek: input.targetDaysPerWeek ?? 7,
      verificationType,
      leetcodeUsername:
        verificationType === 'LEETCODE' ? input.leetcodeUsername?.trim() : null,
      dailyTargetCount: input.dailyTargetCount ?? 1,
    },
  });
}

/**
 * Toggles completion for MANUAL_PROOF habits on TODAY only.
 * Blocks backdating past days and blocks manual toggling of LEETCODE habits.
 */
export async function toggleHabitCompletion(
  habitId: string,
  dateStr?: string,
  todayStr?: string,
  proofNote?: string
) {
  const currentToday = todayStr || formatDateStr(new Date());
  const targetDate = dateStr || currentToday;

  // Rule 1: Anti-cheat lock — prevent faking past or future days
  if (targetDate !== currentToday) {
    throw new AppError(
      'Anti-cheat lock: You can only log goals for today. Past days are locked and cannot be backdated.',
      403
    );
  }

  const habit = await prisma.habit.findUnique({ where: { id: habitId } });
  if (!habit) {
    throw new AppError('Habit not found.', 404);
  }

  // Rule 2: LeetCode habits cannot be manually checked
  if (habit.verificationType === 'LEETCODE') {
    throw new AppError(
      'This goal uses LeetCode Auto-Verification. Click "Sync LeetCode" to verify your real submissions!',
      403
    );
  }

  const existingLog = await prisma.habitLog.findUnique({
    where: {
      habitId_completedDate: {
        habitId,
        completedDate: targetDate,
      },
    },
  });

  if (existingLog) {
    await prisma.habitLog.delete({
      where: { id: existingLog.id },
    });
    return { habitId, completedDate: targetDate, completed: false, note: null };
  }

  const cleanProof = proofNote?.trim() || '';
  if (cleanProof.length < 4) {
    throw new AppError(
      'Proof required: Please enter a brief work summary or commit/PR link (min 4 chars) to verify today\'s goal.',
      400
    );
  }

  const created = await prisma.habitLog.create({
    data: {
      habitId,
      completedDate: targetDate,
      note: cleanProof,
      verifiedCount: habit.dailyTargetCount,
    },
  });

  return {
    habitId,
    completedDate: targetDate,
    completed: true,
    note: created.note,
  };
}

/**
 * Verifies a LEETCODE habit against LeetCode's GraphQL API for today.
 */
export async function verifyLeetCodeHabit(habitId: string, todayStr?: string) {
  const currentToday = todayStr || formatDateStr(new Date());
  const habit = await prisma.habit.findUnique({ where: { id: habitId } });

  if (!habit) {
    throw new AppError('Habit not found.', 404);
  }
  if (habit.verificationType !== 'LEETCODE' || !habit.leetcodeUsername) {
    throw new AppError('This habit is not configured for LeetCode verification.', 400);
  }

  const result = await verifyLeetCodeSubmissionsForDate(
    habit.leetcodeUsername,
    currentToday
  );

  const metTarget = result.solvedTodayCount >= habit.dailyTargetCount;

  if (metTarget) {
    const summaryNote = `Auto-verified via LeetCode (@${result.username}): ${result.solvedTitles.join(', ')}`;
    await prisma.habitLog.upsert({
      where: {
        habitId_completedDate: {
          habitId: habit.id,
          completedDate: currentToday,
        },
      },
      update: {
        note: summaryNote,
        verifiedCount: result.solvedTodayCount,
      },
      create: {
        habitId: habit.id,
        completedDate: currentToday,
        note: summaryNote,
        verifiedCount: result.solvedTodayCount,
      },
    });
  }

  return {
    habitId: habit.id,
    completedDate: currentToday,
    completed: metTarget,
    solvedTodayCount: result.solvedTodayCount,
    dailyTargetCount: habit.dailyTargetCount,
    solvedTitles: result.solvedTitles,
    message: metTarget
      ? `Verified! You solved ${result.solvedTodayCount}/${habit.dailyTargetCount} LeetCode problems today.`
      : `Not yet complete: ${result.solvedTodayCount}/${habit.dailyTargetCount} solved on LeetCode today. Solve ${
          habit.dailyTargetCount - result.solvedTodayCount
        } more to complete this goal!`,
  };
}

export async function deleteHabit(habitId: string) {
  return prisma.habit.delete({
    where: { id: habitId },
  });
}