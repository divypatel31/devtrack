import { prisma } from '../config/db';
import { verifyLeetCodeSubmissionsForDate } from './leetcode.service';
import {
  formatDateStr,
  isValidCalendarDate,
  isWithinAllowedTodayWindow,
} from '../utils/date';

export interface CreateHabitInput {
  userId: string;
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

export { formatDateStr, isValidCalendarDate, isWithinAllowedTodayWindow };

export function getLast7Days(referenceDateStr?: string): string[] {
  if (referenceDateStr !== undefined && !isValidCalendarDate(referenceDateStr)) {
    throw new AppError('Invalid calendar date format. Expected valid YYYY-MM-DD.', 400);
  }
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
  if (!isValidCalendarDate(todayStr)) {
    throw new AppError('Invalid calendar date format. Expected valid YYYY-MM-DD.', 400);
  }
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

export async function getAllHabitsWithStats(userId: string, todayStr?: string) {
  if (todayStr !== undefined && !isValidCalendarDate(todayStr)) {
    throw new AppError('Invalid date format. Expected valid YYYY-MM-DD.', 400);
  }
  const currentDay = todayStr || formatDateStr(new Date());
  const last7Days = getLast7Days(currentDay);

  const habits = await prisma.habit.findMany({
    where: {
      userId,
      isArchived: false,
    },
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
  if (!input.userId) {
    throw new AppError('Authentication required.', 401);
  }

  const cleanTitle = typeof input.title === 'string' ? input.title.trim() : '';
  if (!cleanTitle || cleanTitle.length > 120) {
    throw new AppError('Habit title is required and must be 120 characters or fewer.', 400);
  }

  const cleanCategory =
    typeof input.category === 'string' && input.category.trim().length > 0
      ? input.category.trim()
      : 'General';
  if (cleanCategory.length > 40) {
    throw new AppError('Category must be 40 characters or fewer.', 400);
  }

  const verificationType =
    input.verificationType === 'LEETCODE' ? 'LEETCODE' : 'MANUAL_PROOF';

  const cleanLcUser =
    typeof input.leetcodeUsername === 'string' ? input.leetcodeUsername.trim() : '';

  if (verificationType === 'LEETCODE') {
    if (!cleanLcUser) {
      throw new AppError('LeetCode username is required for LeetCode auto-verified goals.', 400);
    }
    if (!/^[a-zA-Z0-9_-]{1,50}$/.test(cleanLcUser)) {
      throw new AppError('Invalid LeetCode username format.', 400);
    }
  }

  return prisma.habit.create({
    data: {
      userId: input.userId,
      title: cleanTitle,
      category: cleanCategory,
      targetDaysPerWeek: input.targetDaysPerWeek ?? 7,
      verificationType,
      leetcodeUsername: verificationType === 'LEETCODE' ? cleanLcUser : null,
      dailyTargetCount: input.dailyTargetCount ?? 1,
    },
  });
}

/**
 * Toggles completion for MANUAL_PROOF habits on TODAY only, enforcing userId ownership
 * and server-bounded timezone clock verification.
 */
export async function toggleHabitCompletion(
  userId: string,
  habitId: string,
  dateStr?: string,
  todayStr?: string,
  proofNote?: string
) {
  const serverUtcToday = formatDateStr(new Date());
  const currentToday = todayStr || serverUtcToday;
  const targetDate = dateStr || currentToday;

  if (!isValidCalendarDate(currentToday) || !isValidCalendarDate(targetDate)) {
    throw new AppError('Invalid calendar date format. Expected valid YYYY-MM-DD.', 400);
  }

  // Rule 1a: Client date must match today's date
  if (targetDate !== currentToday) {
    throw new AppError(
      'Anti-cheat lock: You can only log goals for today. Past days are locked and cannot be backdated.',
      403
    );
  }

  // Rule 1b: Prevent client from spoofing `today` to an arbitrary past/future date outside real-world timezones
  if (!isWithinAllowedTodayWindow(targetDate)) {
    throw new AppError(
      'Anti-cheat lock: Target date is outside the current server day window.',
      403
    );
  }

  // Enforce ownership in the database query
  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
  });
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
        habitId: habit.id,
        completedDate: targetDate,
      },
    },
  });

  if (existingLog) {
    await prisma.habitLog.delete({
      where: { id: existingLog.id },
    });
    return { habitId: habit.id, completedDate: targetDate, completed: false, note: null };
  }

  const cleanProof = typeof proofNote === 'string' ? proofNote.trim() : '';
  if (cleanProof.length < 4 || cleanProof.length > 500) {
    throw new AppError(
      'Proof required: Please enter a brief work summary or commit/PR link (4 to 500 chars) to verify today\'s goal.',
      400
    );
  }

  const created = await prisma.habitLog.create({
    data: {
      habitId: habit.id,
      completedDate: targetDate,
      note: cleanProof,
      verifiedCount: habit.dailyTargetCount,
    },
  });

  return {
    habitId: habit.id,
    completedDate: targetDate,
    completed: true,
    note: created.note,
  };
}

/**
 * Verifies a LEETCODE habit against LeetCode's GraphQL API for today, enforcing ownership.
 */
export async function verifyLeetCodeHabit(
  userId: string,
  habitId: string,
  todayStr?: string
) {
  const serverUtcToday = formatDateStr(new Date());
  const currentToday = todayStr || serverUtcToday;

  if (!isValidCalendarDate(currentToday)) {
    throw new AppError('Invalid today format. Expected valid YYYY-MM-DD.', 400);
  }

  if (!isWithinAllowedTodayWindow(currentToday)) {
    throw new AppError(
      'Anti-cheat lock: Verification date is outside the current server day window.',
      403
    );
  }

  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
  });

  if (!habit) {
    throw new AppError('Habit not found.', 404);
  }
  if (habit.verificationType !== 'LEETCODE' || !habit.leetcodeUsername) {
    throw new AppError('This habit is not configured for LeetCode verification.', 400);
  }

  let result;
  try {
    result = await verifyLeetCodeSubmissionsForDate(
      habit.leetcodeUsername,
      currentToday
    );
  } catch (err) {
    const message = err instanceof Error ? err.message : 'Unable to verify LeetCode submissions.';
    throw new AppError(message, 400);
  }

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

export async function deleteHabit(userId: string, habitId: string) {
  const deleted = await prisma.habit.deleteMany({
    where: { id: habitId, userId },
  });

  if (deleted.count === 0) {
    throw new AppError('Habit not found.', 404);
  }

  return { deleted: true, id: habitId };
}