import { prisma } from '../config/db';

export interface CreateHabitInput {
  title: string;
  category?: string;
  targetDaysPerWeek?: number;
}

/**
 * Formats a Date object as YYYY-MM-DD in UTC.
 */
export function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Generates an array of the last 7 calendar dates (YYYY-MM-DD) ending on referenceDate.
 */
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

/**
 * Calculates consecutive completed days up to today (or yesterday if today is not yet completed).
 */
export function calculateCurrentStreak(
  completedDates: Set<string>,
  todayStr: string
): number {
  let streak = 0;
  const cursor = new Date(`${todayStr}T00:00:00.000Z`);

  // If not completed today, check if streak is still alive from yesterday
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

/**
 * Fetches all active habits along with their current streak and 7-day completion history.
 */
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
    const completedSet = new Set(habit.logs.map((log) => log.completedDate));
    const currentStreak = calculateCurrentStreak(completedSet, currentDay);
    const completedToday = completedSet.has(currentDay);

    const weeklyProgress = last7Days.map((date) => ({
      date,
      completed: completedSet.has(date),
    }));

    return {
      id: habit.id,
      title: habit.title,
      category: habit.category,
      targetDaysPerWeek: habit.targetDaysPerWeek,
      createdAt: habit.createdAt,
      completedToday,
      currentStreak,
      weeklyProgress,
    };
  });
}

/**
 * Creates a new habit.
 */
export async function createHabit(input: CreateHabitInput) {
  return prisma.habit.create({
    data: {
      title: input.title.trim(),
      category: input.category?.trim() || 'General',
      targetDaysPerWeek: input.targetDaysPerWeek ?? 7,
    },
  });
}

/**
 * Toggles completion of a habit for a specific YYYY-MM-DD date.
 */
export async function toggleHabitCompletion(habitId: string, dateStr?: string) {
  const targetDate = dateStr || formatDateStr(new Date());

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
    return { habitId, completedDate: targetDate, completed: false };
  }

  await prisma.habitLog.create({
    data: {
      habitId,
      completedDate: targetDate,
    },
  });

  return { habitId, completedDate: targetDate, completed: true };
}

/**
 * Deletes a habit (and cascades its logs).
 */
export async function deleteHabit(habitId: string) {
  return prisma.habit.delete({
    where: { id: habitId },
  });
}