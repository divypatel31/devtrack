import { prisma } from '../config/db';
import { verifyLeetCodeSubmissionsForDate } from './leetcode.service';
import {
  ALL_WEEKDAYS,
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
  parseTimezoneOffsetMinutes,
} from '../utils/date';

export interface CreateHabitInput {
  userId: string;
  domain?: string;
  title: string;
  category?: string;
  targetDaysPerWeek?: number;
  scheduledDays?: number[];
  verificationType?: 'MANUAL_PROOF' | 'LEETCODE';
  leetcodeUsername?: string;
  dailyTargetCount?: number;
}

export interface UpdateHabitInput {
  domain?: string;
  title?: string;
  category?: string;
  scheduledDays?: number[];
  dailyTargetCount?: number;
  leetcodeUsername?: string;
  isArchived?: boolean;
}

export interface DailyTrendPoint {
  date: string;
  scheduledCount: number;
  completedCount: number;
  completionPercentage: number;
}

export interface UserHabitAnalytics {
  todayStr: string;
  todayScheduledCount: number;
  todayCompletedCount: number;
  todayCompletionPercentage: number;
  weeklyScheduledCount: number;
  weeklyCompletedCount: number;
  weeklyCompletionPercentage: number;
  thirtyDayScheduledCount: number;
  thirtyDayCompletedCount: number;
  thirtyDayCompletionPercentage: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletedScheduledHabits: number;
  trend7Days: DailyTrendPoint[];
  trend30Days: DailyTrendPoint[];
}

export type CalendarDayStatus =
  | 'completed'
  | 'partial'
  | 'pending_today'
  | 'missed'
  | 'unscheduled'
  | 'future'
  | 'before_created';

export interface CalendarDayCell {
  date: string;
  weekday: number;
  status: CalendarDayStatus;
  scheduledCount: number;
  completedCount: number;
  completedHabitTitles: string[];
  notes: string[];
}

export interface MonthlyCalendarResponse {
  month: string;
  todayStr: string;
  habitId: string | null;
  totalHabitsIncluded: number;
  summary: {
    completedDays: number;
    partialDays: number;
    missedDays: number;
    unscheduledDays: number;
    totalCompletedLogsInMonth: number;
  };
  days: CalendarDayCell[];
}

export class AppError extends Error {
  statusCode: number;
  constructor(message: string, statusCode = 400) {
    super(message);
    this.statusCode = statusCode;
  }
}

export {
  formatDateStr,
  isValidCalendarDate,
  isValidYearMonth,
  isWithinAllowedTodayWindow,
  normalizeScheduledDays,
  parseTimezoneOffsetMinutes,
  getTodayForTimezone,
};

export function getLast7Days(referenceDateStr?: string): string[] {
  if (referenceDateStr !== undefined && !isValidCalendarDate(referenceDateStr)) {
    throw new AppError('Invalid calendar date format. Expected valid YYYY-MM-DD.', 400);
  }
  const baseDateStr = referenceDateStr || formatDateStr(new Date());
  return getDateRangeEndingAt(baseDateStr, 7);
}

export function isHabitScheduledOnDate(
  scheduledDays: readonly number[],
  dateStr: string
): boolean {
  const weekday = getWeekdayIndex(dateStr);
  return scheduledDays.includes(weekday);
}

/**
 * Calculates the current active streak for a habit as of todayStr.
 */
export function calculateCurrentStreak(
  completedDates: Set<string>,
  todayStr: string,
  scheduledDays: readonly number[] = ALL_WEEKDAYS
): number {
  if (!isValidCalendarDate(todayStr)) {
    throw new AppError('Invalid calendar date format. Expected valid YYYY-MM-DD.', 400);
  }
  if (completedDates.size === 0 || scheduledDays.length === 0) {
    return 0;
  }

  const scheduledSet = new Set(scheduledDays);
  let earliestCompleted = todayStr;
  for (const d of completedDates) {
    if (d < earliestCompleted) {
      earliestCompleted = d;
    }
  }

  let streak = 0;
  let cursorStr = todayStr;
  let checkedFirstScheduledDay = false;

  while (cursorStr >= earliestCompleted) {
    const weekday = getWeekdayIndex(cursorStr);

    if (!scheduledSet.has(weekday)) {
      cursorStr = addCalendarDays(cursorStr, -1);
      continue;
    }

    if (!checkedFirstScheduledDay) {
      checkedFirstScheduledDay = true;
      if (completedDates.has(cursorStr)) {
        streak++;
      } else if (cursorStr !== todayStr) {
        return 0;
      }
      cursorStr = addCalendarDays(cursorStr, -1);
      continue;
    }

    if (completedDates.has(cursorStr)) {
      streak++;
      cursorStr = addCalendarDays(cursorStr, -1);
    } else {
      break;
    }
  }

  return streak;
}

/**
 * Calculates the longest historical streak of scheduled completions up to todayStr.
 */
export function calculateLongestStreak(
  completedDates: Set<string>,
  todayStr: string,
  scheduledDays: readonly number[] = ALL_WEEKDAYS
): number {
  if (!isValidCalendarDate(todayStr)) {
    throw new AppError('Invalid calendar date format. Expected valid YYYY-MM-DD.', 400);
  }
  if (completedDates.size === 0 || scheduledDays.length === 0) {
    return 0;
  }

  const scheduledSet = new Set(scheduledDays);
  const sortedDates = Array.from(completedDates)
    .filter((d) => d <= todayStr && isValidCalendarDate(d))
    .sort();

  if (sortedDates.length === 0) {
    return 0;
  }

  const firstDate = sortedDates[0];
  let cursorStr = firstDate;
  let runningStreak = 0;
  let longestStreak = 0;

  while (cursorStr <= todayStr) {
    const weekday = getWeekdayIndex(cursorStr);
    const isScheduled = scheduledSet.has(weekday);
    const isCompleted = completedDates.has(cursorStr);

    if (isScheduled) {
      if (isCompleted) {
        runningStreak++;
        if (runningStreak > longestStreak) {
          longestStreak = runningStreak;
        }
      } else if (cursorStr < todayStr) {
        runningStreak = 0;
      }
    }

    cursorStr = addCalendarDays(cursorStr, 1);
  }

  return longestStreak;
}

/**
 * Loads user habits once and computes enriched habit models and 7/30-day per-user analytics.
 * Archived habits are excluded from active daily schedule obligations unless includeArchived is true,
 * while their historical completions remain preserved in the database.
 */
export async function getHabitsAndAnalyticsForUser(
  userId: string,
  todayStr?: string,
  timezoneOffsetMinutes?: number,
  includeArchived = false
) {
  const tzOffset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes, 0);
  const currentDay = todayStr || getTodayForTimezone(tzOffset);

  if (!isValidCalendarDate(currentDay)) {
    throw new AppError('Invalid date format. Expected valid YYYY-MM-DD.', 400);
  }

  const last7Days = getDateRangeEndingAt(currentDay, 7);
  const last30Days = getDateRangeEndingAt(currentDay, 30);

  const habits = await prisma.habit.findMany({
    where: {
      userId,

    },
    include: {
      logs: {
        orderBy: { completedDate: 'desc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  let totalCompletedScheduledHabits = 0;

  const enrichedHabits = habits.map((habit) => {
    const scheduledDays =
      Array.isArray(habit.scheduledDays) && habit.scheduledDays.length > 0
        ? habit.scheduledDays
        : [...ALL_WEEKDAYS];
    const scheduledSet = new Set(scheduledDays);

    const logMap = new Map(habit.logs.map((log) => [log.completedDate, log]));
    const completedSet = new Set(habit.logs.map((log) => log.completedDate));

    for (const completedDate of completedSet) {
      if (
        completedDate <= currentDay &&
        isValidCalendarDate(completedDate) &&
        scheduledSet.has(getWeekdayIndex(completedDate))
      ) {
        totalCompletedScheduledHabits++;
      }
    }

    const currentStreak = habit.isArchived
      ? 0
      : calculateCurrentStreak(completedSet, currentDay, scheduledDays);
    const longestStreak = calculateLongestStreak(completedSet, currentDay, scheduledDays);
    const todayLog = logMap.get(currentDay);
    const isScheduledToday = !habit.isArchived && scheduledSet.has(getWeekdayIndex(currentDay));
    const completedToday = Boolean(todayLog);

    const createdDateStr = formatDateStr(habit.createdAt);
    let effectiveStartStr = createdDateStr;
    for (const d of completedSet) {
      if (d < effectiveStartStr) {
        effectiveStartStr = d;
      }
    }

    const weeklyProgress = last7Days.map((date) => ({
      date,
      isScheduled:
        !habit.isArchived && date >= effectiveStartStr && scheduledSet.has(getWeekdayIndex(date)),
      completed: completedSet.has(date),
      note: logMap.get(date)?.note || null,
      verifiedCount: logMap.get(date)?.verifiedCount || 0,
    }));

    return {
      id: habit.id,
      userId: habit.userId,
      domain: habit.domain || 'DEVELOPER',
      title: habit.title,
      category: habit.category,
      targetDaysPerWeek: scheduledDays.length,
      scheduledDays,
      verificationType: habit.verificationType,
      leetcodeUsername: habit.leetcodeUsername,
      dailyTargetCount: habit.dailyTargetCount,
      isArchived: habit.isArchived,
      createdAt: habit.createdAt,
      effectiveStartStr,
      isScheduledToday,
      completedToday,
      todayNote: todayLog?.note || null,
      todayVerifiedCount: todayLog?.verifiedCount || 0,
      currentStreak,
      longestStreak,
      weeklyProgress,
      _completedSet: completedSet,
      _scheduledSet: scheduledSet,
    };
  });

  const activeHabits = enrichedHabits.filter((h) => !h.isArchived);

  function computeTrend(dates: string[]): DailyTrendPoint[] {
    return dates.map((date) => {
      const weekday = getWeekdayIndex(date);
      let scheduledCount = 0;
      let completedCount = 0;

      for (const h of activeHabits) {
        if (date >= h.effectiveStartStr && h._scheduledSet.has(weekday)) {
          scheduledCount++;
          if (h._completedSet.has(date)) {
            completedCount++;
          }
        }
      }

      const completionPercentage =
        scheduledCount > 0 ? Math.round((completedCount / scheduledCount) * 100) : 0;

      return {
        date,
        scheduledCount,
        completedCount,
        completionPercentage,
      };
    });
  }

  const trend7Days = computeTrend(last7Days);
  const trend30Days = computeTrend(last30Days);

  const todayPoint = trend7Days[trend7Days.length - 1] || {
    date: currentDay,
    scheduledCount: 0,
    completedCount: 0,
    completionPercentage: 0,
  };

  const weeklyScheduledCount = trend7Days.reduce((s, d) => s + d.scheduledCount, 0);
  const weeklyCompletedCount = trend7Days.reduce((s, d) => s + d.completedCount, 0);
  const weeklyCompletionPercentage =
    weeklyScheduledCount > 0
      ? Math.round((weeklyCompletedCount / weeklyScheduledCount) * 100)
      : 0;

  const thirtyDayScheduledCount = trend30Days.reduce((s, d) => s + d.scheduledCount, 0);
  const thirtyDayCompletedCount = trend30Days.reduce((s, d) => s + d.completedCount, 0);
  const thirtyDayCompletionPercentage =
    thirtyDayScheduledCount > 0
      ? Math.round((thirtyDayCompletedCount / thirtyDayScheduledCount) * 100)
      : 0;

  const bestCurrentStreak = activeHabits.reduce(
    (max, h) => Math.max(max, h.currentStreak),
    0
  );
  const bestLongestStreak = enrichedHabits.reduce(
    (max, h) => Math.max(max, h.longestStreak),
    0
  );

  const analytics: UserHabitAnalytics = {
    todayStr: currentDay,
    todayScheduledCount: todayPoint.scheduledCount,
    todayCompletedCount: todayPoint.completedCount,
    todayCompletionPercentage: todayPoint.completionPercentage,
    weeklyScheduledCount,
    weeklyCompletedCount,
    weeklyCompletionPercentage,
    thirtyDayScheduledCount,
    thirtyDayCompletedCount,
    thirtyDayCompletionPercentage,
    currentStreak: bestCurrentStreak,
    longestStreak: bestLongestStreak,
    totalCompletedScheduledHabits,
    trend7Days,
    trend30Days,
  };

  const visibleHabits = includeArchived ? enrichedHabits : activeHabits;
  const publicHabits = visibleHabits.map(
    ({ _completedSet, _scheduledSet, effectiveStartStr, ...rest }) => rest
  );

  return { habits: publicHabits, analytics };
}

/**
 * Generates an accurate monthly calendar (YYYY-MM) for the authenticated user based on actual
 * completion records and per-habit creation & weekday schedule boundaries.
 */
export async function getMonthlyCalendarForUser(
  userId: string,
  monthStr?: string,
  todayStr?: string,
  timezoneOffsetMinutes?: number,
  habitId?: string,
  domain?: string
): Promise<MonthlyCalendarResponse> {
  const tzOffset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes, 0);
  const currentDay = todayStr || getTodayForTimezone(tzOffset);

  if (!isValidCalendarDate(currentDay)) {
    throw new AppError('Invalid today date format. Expected valid YYYY-MM-DD.', 400);
  }

  const targetMonth = monthStr || currentDay.slice(0, 7);
  if (!isValidYearMonth(targetMonth)) {
    throw new AppError('Invalid month format. Expected valid YYYY-MM.', 400);
  }

  const monthDates = getDatesInMonth(targetMonth);
  const monthStart = monthDates[0];
  const monthEnd = monthDates[monthDates.length - 1];

  const habits = await prisma.habit.findMany({
    where: {
      userId,
      ...(habitId ? { id: habitId } : { isArchived: false }),
      ...(domain && ['DEVELOPER', 'ATHLETE', 'LEARNING'].includes(domain) ? { domain } : {}),
    },
    include: {
      logs: {
        where: {
          completedDate: {
            gte: monthStart,
            lte: monthEnd,
          },
        },
        orderBy: { completedDate: 'asc' },
      },
    },
    orderBy: { createdAt: 'asc' },
  });

  if (habitId && habits.length === 0) {
    throw new AppError('Habit not found.', 404);
  }

  const preparedHabits = habits.map((h) => {
    const scheduledDays =
      Array.isArray(h.scheduledDays) && h.scheduledDays.length > 0
        ? h.scheduledDays
        : [...ALL_WEEKDAYS];
    const scheduledSet = new Set(scheduledDays);
    const createdDateStr = formatDateStr(h.createdAt);
    const logMap = new Map(h.logs.map((l) => [l.completedDate, l]));

    let effectiveStartStr = createdDateStr;
    for (const l of h.logs) {
      if (l.completedDate < effectiveStartStr) {
        effectiveStartStr = l.completedDate;
      }
    }

    return {
      id: h.id,
      title: h.title,
      effectiveStartStr,
      scheduledSet,
      logMap,
    };
  });

  let completedDays = 0;
  let partialDays = 0;
  let missedDays = 0;
  let unscheduledDays = 0;
  let totalCompletedLogsInMonth = 0;

  const days: CalendarDayCell[] = monthDates.map((date) => {
    const weekday = getWeekdayIndex(date);
    let scheduledCount = 0;
    let completedCount = 0;
    let activeHabitsOnDate = 0;
    const completedHabitTitles: string[] = [];
    const notes: string[] = [];

    for (const h of preparedHabits) {
      const hasLog = h.logMap.get(date);
      if (hasLog) {
        completedCount++;
        totalCompletedLogsInMonth++;
        completedHabitTitles.push(h.title);
        if (hasLog.note) {
          notes.push(`${h.title}: ${hasLog.note}`);
        }
      }

      if (date >= h.effectiveStartStr) {
        activeHabitsOnDate++;
        if (h.scheduledSet.has(weekday)) {
          scheduledCount++;
        }
      }
    }

    let status: CalendarDayStatus;
    if (date > currentDay) {
      status = 'future';
    } else if (preparedHabits.length === 0 || activeHabitsOnDate === 0) {
      status = completedCount > 0 ? 'completed' : 'before_created';
    } else if (scheduledCount === 0) {
      status = completedCount > 0 ? 'completed' : 'unscheduled';
      if (status === 'unscheduled') unscheduledDays++;
      if (status === 'completed') completedDays++;
    } else if (completedCount >= scheduledCount) {
      status = 'completed';
      completedDays++;
    } else if (completedCount > 0) {
      status = 'partial';
      partialDays++;
    } else if (date === currentDay) {
      status = 'pending_today';
    } else {
      status = 'missed';
      missedDays++;
    }

    return {
      date,
      weekday,
      status,
      scheduledCount,
      completedCount,
      completedHabitTitles,
      notes,
    };
  });

  return {
    month: targetMonth,
    todayStr: currentDay,
    habitId: habitId || null,
    totalHabitsIncluded: preparedHabits.length,
    summary: {
      completedDays,
      partialDays,
      missedDays,
      unscheduledDays,
      totalCompletedLogsInMonth,
    },
    days,
  };
}

export async function getAllHabitsWithStats(
  userId: string,
  todayStr?: string,
  timezoneOffsetMinutes?: number
) {
  const { habits } = await getHabitsAndAnalyticsForUser(
    userId,
    todayStr,
    timezoneOffsetMinutes
  );
  return habits;
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

  let normalizedSchedule: number[];
  try {
    normalizedSchedule = normalizeScheduledDays(input.scheduledDays);
  } catch (err) {
    throw new AppError(err instanceof Error ? err.message : 'Invalid scheduledDays.', 400);
  }

  const targetDaysPerWeek =
    input.scheduledDays !== undefined
      ? normalizedSchedule.length
      : input.targetDaysPerWeek ?? normalizedSchedule.length;

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
      domain: input.domain === 'ATHLETE' || input.domain === 'LEARNING' ? input.domain : 'DEVELOPER',
      title: cleanTitle,
      category: cleanCategory,
      targetDaysPerWeek,
      scheduledDays: normalizedSchedule,
      verificationType,
      leetcodeUsername: verificationType === 'LEETCODE' ? cleanLcUser : null,
      dailyTargetCount: input.dailyTargetCount ?? 1,
    },
  });
}

export async function updateHabit(
  userId: string,
  habitId: string,
  input: UpdateHabitInput
) {
  const existing = await prisma.habit.findFirst({
    where: { id: habitId, userId },
  });
  if (!existing) {
    throw new AppError('Habit not found.', 404);
  }

  const data: {
    domain?: string;
    title?: string;
    category?: string;
    scheduledDays?: number[];
    targetDaysPerWeek?: number;
    dailyTargetCount?: number;
    leetcodeUsername?: string | null;
    isArchived?: boolean;
  } = {};

  if (input.domain !== undefined) {
    if (!['DEVELOPER', 'ATHLETE', 'LEARNING'].includes(input.domain)) {
      throw new AppError('domain must be DEVELOPER, ATHLETE, or LEARNING.', 400);
    }
    data.domain = input.domain;
  }

  if (input.title !== undefined) {
    const cleanTitle = typeof input.title === 'string' ? input.title.trim() : '';
    if (!cleanTitle || cleanTitle.length > 120) {
      throw new AppError('Habit title must be between 1 and 120 characters.', 400);
    }
    data.title = cleanTitle;
  }

  if (input.category !== undefined) {
    const cleanCategory = typeof input.category === 'string' ? input.category.trim() : '';
    if (!cleanCategory || cleanCategory.length > 40) {
      throw new AppError('Category must be between 1 and 40 characters.', 400);
    }
    data.category = cleanCategory;
  }

  if (input.scheduledDays !== undefined) {
    try {
      const normalized = normalizeScheduledDays(input.scheduledDays);
      data.scheduledDays = normalized;
      data.targetDaysPerWeek = normalized.length;
    } catch (err) {
      throw new AppError(err instanceof Error ? err.message : 'Invalid scheduledDays.', 400);
    }
  }

  if (input.dailyTargetCount !== undefined) {
    const parsedCount = Number(input.dailyTargetCount);
    if (!Number.isInteger(parsedCount) || parsedCount < 1 || parsedCount > 20) {
      throw new AppError('dailyTargetCount must be an integer between 1 and 20.', 400);
    }
    data.dailyTargetCount = parsedCount;
  }

  if (input.leetcodeUsername !== undefined) {
    if (existing.verificationType === 'LEETCODE') {
      const cleanLc = typeof input.leetcodeUsername === 'string' ? input.leetcodeUsername.trim() : '';
      if (!cleanLc || !/^[a-zA-Z0-9_-]{1,50}$/.test(cleanLc)) {
        throw new AppError('Valid LeetCode username is required for LeetCode habits.', 400);
      }
      data.leetcodeUsername = cleanLc;
    }
  }

  if (input.isArchived !== undefined) {
    if (typeof input.isArchived !== 'boolean') {
      throw new AppError('isArchived must be a boolean.', 400);
    }
    data.isArchived = input.isArchived;
  }

  return prisma.habit.update({
    where: { id: existing.id },
    data,
  });
}

/**
 * Toggles completion for MANUAL_PROOF habits on TODAY only.
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

  if (targetDate !== currentToday) {
    throw new AppError(
      'Anti-cheat lock: You can only log goals for today. Past days are locked and cannot be backdated.',
      403
    );
  }

  if (!isWithinAllowedTodayWindow(targetDate)) {
    throw new AppError(
      'Anti-cheat lock: Target date is outside the current server day window.',
      403
    );
  }

  const habit = await prisma.habit.findFirst({
    where: { id: habitId, userId },
  });
  if (!habit) {
    throw new AppError('Habit not found.', 404);
  }

  if (habit.isArchived) {
    throw new AppError('Cannot log completions on an archived habit. Restore it first.', 400);
  }

  if (habit.verificationType === 'LEETCODE') {
    throw new AppError(
      'This goal uses LeetCode Auto-Verification. Click "Sync LeetCode" to verify your real submissions!',
      403
    );
  }

  const scheduledDays =
    Array.isArray(habit.scheduledDays) && habit.scheduledDays.length > 0
      ? habit.scheduledDays
      : [...ALL_WEEKDAYS];

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
    const remainingLogs = await prisma.habitLog.findMany({
      where: { habitId: habit.id },
      select: { completedDate: true },
    });
    const remainingSet = new Set(remainingLogs.map((l) => l.completedDate));
    return {
      habitId: habit.id,
      completedDate: targetDate,
      completed: false,
      note: null,
      currentStreak: calculateCurrentStreak(remainingSet, currentToday, scheduledDays),
      longestStreak: calculateLongestStreak(remainingSet, currentToday, scheduledDays),
    };
  }

  if (!isHabitScheduledOnDate(scheduledDays, targetDate)) {
    throw new AppError('This habit is not scheduled for today.', 400);
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

  const updatedLogs = await prisma.habitLog.findMany({
    where: { habitId: habit.id },
    select: { completedDate: true },
  });
  const updatedSet = new Set(updatedLogs.map((l) => l.completedDate));

  return {
    habitId: habit.id,
    completedDate: targetDate,
    completed: true,
    note: created.note,
    currentStreak: calculateCurrentStreak(updatedSet, currentToday, scheduledDays),
    longestStreak: calculateLongestStreak(updatedSet, currentToday, scheduledDays),
  };
}

/**
 * Verifies a LEETCODE habit against LeetCode's GraphQL API for today.
 */
export async function verifyLeetCodeHabit(
  userId: string,
  habitId: string,
  todayStr?: string,
  timezoneOffsetMinutes?: number
) {
  const tzOffset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes, 330);
  const currentToday = todayStr || getTodayForTimezone(tzOffset);

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
  if (habit.isArchived) {
    throw new AppError('Cannot verify an archived habit. Restore it first.', 400);
  }
  if (habit.verificationType !== 'LEETCODE' || !habit.leetcodeUsername) {
    throw new AppError('This habit is not configured for LeetCode verification.', 400);
  }

  const scheduledDays =
    Array.isArray(habit.scheduledDays) && habit.scheduledDays.length > 0
      ? habit.scheduledDays
      : [...ALL_WEEKDAYS];

  if (!isHabitScheduledOnDate(scheduledDays, currentToday)) {
    throw new AppError('This habit is not scheduled for today.', 400);
  }

  let result;
  try {
    result = await verifyLeetCodeSubmissionsForDate(
      habit.leetcodeUsername,
      currentToday,
      tzOffset
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

  const allLogs = await prisma.habitLog.findMany({
    where: { habitId: habit.id },
    select: { completedDate: true },
  });
  const completedSet = new Set(allLogs.map((l) => l.completedDate));

  return {
    habitId: habit.id,
    completedDate: currentToday,
    completed: metTarget,
    solvedTodayCount: result.solvedTodayCount,
    dailyTargetCount: habit.dailyTargetCount,
    solvedTitles: result.solvedTitles,
    currentStreak: calculateCurrentStreak(completedSet, currentToday, scheduledDays),
    longestStreak: calculateLongestStreak(completedSet, currentToday, scheduledDays),
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