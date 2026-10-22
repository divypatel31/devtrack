import { Request, Response } from 'express';
import * as habitService from '../services/habit.service';
import {
  AppError,
  isValidCalendarDate,
  isValidYearMonth,
  parseTimezoneOffsetMinutes,
} from '../services/habit.service';

export async function listHabits(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const dateQuery = req.query.date !== undefined ? String(req.query.date) : undefined;
    if (dateQuery !== undefined && !isValidCalendarDate(dateQuery)) {
      res.status(400).json({ error: 'Invalid date format. Expected valid YYYY-MM-DD.' });
      return;
    }

    let tzOffset: number | undefined;
    if (req.query.tzOffset !== undefined) {
      try {
        tzOffset = parseTimezoneOffsetMinutes(req.query.tzOffset);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid tzOffset.' });
        return;
      }
    }

    const includeArchived = req.query.includeArchived === 'true';

    const { habits, analytics } = await habitService.getHabitsAndAnalyticsForUser(
      req.user.id,
      dateQuery,
      tzOffset,
      includeArchived
    );
    res.status(200).json({ habits, analytics });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] listHabits error:', error);
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
}

export async function getAnalytics(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const dateQuery = req.query.date !== undefined ? String(req.query.date) : undefined;
    if (dateQuery !== undefined && !isValidCalendarDate(dateQuery)) {
      res.status(400).json({ error: 'Invalid date format. Expected valid YYYY-MM-DD.' });
      return;
    }

    let tzOffset: number | undefined;
    if (req.query.tzOffset !== undefined) {
      try {
        tzOffset = parseTimezoneOffsetMinutes(req.query.tzOffset);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid tzOffset.' });
        return;
      }
    }

    const { analytics } = await habitService.getHabitsAndAnalyticsForUser(
      req.user.id,
      dateQuery,
      tzOffset
    );
    res.status(200).json({ analytics });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] getAnalytics error:', error);
    res.status(500).json({ error: 'Failed to fetch habit analytics' });
  }
}

export async function getCalendar(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const monthQuery = req.query.month !== undefined ? String(req.query.month) : undefined;
    if (monthQuery !== undefined && !isValidYearMonth(monthQuery)) {
      res.status(400).json({ error: 'Invalid month format. Expected valid YYYY-MM.' });
      return;
    }

    const todayQuery = req.query.date !== undefined ? String(req.query.date) : undefined;
    if (todayQuery !== undefined && !isValidCalendarDate(todayQuery)) {
      res.status(400).json({ error: 'Invalid date format. Expected valid YYYY-MM-DD.' });
      return;
    }

    let tzOffset: number | undefined;
    if (req.query.tzOffset !== undefined) {
      try {
        tzOffset = parseTimezoneOffsetMinutes(req.query.tzOffset);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid tzOffset.' });
        return;
      }
    }

    const habitId =
      typeof req.query.habitId === 'string' && req.query.habitId.trim().length > 0
        ? req.query.habitId.trim()
        : undefined;

    const calendar = await habitService.getMonthlyCalendarForUser(
      req.user.id,
      monthQuery,
      todayQuery,
      tzOffset,
      habitId
    );
    res.status(200).json({ calendar });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] getCalendar error:', error);
    res.status(500).json({ error: 'Failed to fetch monthly habit calendar' });
  }
}

export async function createNewHabit(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const {
      title,
      category,
      targetDaysPerWeek,
      scheduledDays,
      verificationType,
      leetcodeUsername,
      dailyTargetCount,
    } = req.body ?? {};

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Habit title is required.' });
      return;
    }

    const parsedTarget =
      targetDaysPerWeek !== undefined ? Number(targetDaysPerWeek) : 7;
    if (!Number.isInteger(parsedTarget) || parsedTarget < 1 || parsedTarget > 7) {
      res.status(400).json({ error: 'targetDaysPerWeek must be an integer between 1 and 7.' });
      return;
    }

    const parsedDailyCount =
      dailyTargetCount !== undefined ? Number(dailyTargetCount) : 1;
    if (!Number.isInteger(parsedDailyCount) || parsedDailyCount < 1 || parsedDailyCount > 20) {
      res.status(400).json({ error: 'dailyTargetCount must be an integer between 1 and 20.' });
      return;
    }

    const habit = await habitService.createHabit({
      userId: req.user.id,
      title,
      category: typeof category === 'string' ? category : 'General',
      targetDaysPerWeek: parsedTarget,
      scheduledDays,
      verificationType: verificationType === 'LEETCODE' ? 'LEETCODE' : 'MANUAL_PROOF',
      leetcodeUsername: typeof leetcodeUsername === 'string' ? leetcodeUsername : undefined,
      dailyTargetCount: parsedDailyCount,
    });

    res.status(201).json({ habit });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] createNewHabit error:', error);
    res.status(500).json({ error: 'Failed to create habit' });
  }
}

export async function patchHabit(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const habitId = String(req.params.id);
    const {
      title,
      category,
      scheduledDays,
      dailyTargetCount,
      leetcodeUsername,
      isArchived,
    } = req.body ?? {};

    const updated = await habitService.updateHabit(req.user.id, habitId, {
      title,
      category,
      scheduledDays,
      dailyTargetCount,
      leetcodeUsername,
      isArchived,
    });
    res.status(200).json({ habit: updated });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] patchHabit error:', error);
    res.status(500).json({ error: 'Failed to update habit' });
  }
}

export async function toggleHabit(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const habitId = String(req.params.id);
    const { date, today, note } = req.body ?? {};

    if (date !== undefined && !isValidCalendarDate(date)) {
      res.status(400).json({ error: 'Invalid date format. Expected valid YYYY-MM-DD.' });
      return;
    }
    if (today !== undefined && !isValidCalendarDate(today)) {
      res.status(400).json({ error: 'Invalid today format. Expected valid YYYY-MM-DD.' });
      return;
    }

    const result = await habitService.toggleHabitCompletion(
      req.user.id,
      habitId,
      date,
      today,
      typeof note === 'string' ? note : undefined
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] toggleHabit error:', error);
    res.status(500).json({ error: 'Failed to toggle habit completion' });
  }
}

export async function verifyLeetCode(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const habitId = String(req.params.id);
    const { today, timezoneOffsetMinutes } = req.body ?? {};

    if (today !== undefined && !isValidCalendarDate(today)) {
      res.status(400).json({ error: 'Invalid today format. Expected valid YYYY-MM-DD.' });
      return;
    }

    let tzOffset: number | undefined;
    if (timezoneOffsetMinutes !== undefined) {
      try {
        tzOffset = parseTimezoneOffsetMinutes(timezoneOffsetMinutes);
      } catch (err) {
        res.status(400).json({ error: err instanceof Error ? err.message : 'Invalid timezoneOffsetMinutes.' });
        return;
      }
    }

    const result = await habitService.verifyLeetCodeHabit(
      req.user.id,
      habitId,
      today,
      tzOffset
    );
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to verify with LeetCode' });
  }
}

export async function removeHabit(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }

    const habitId = String(req.params.id);
    const result = await habitService.deleteHabit(req.user.id, habitId);
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] removeHabit error:', error);
    res.status(500).json({ error: 'Failed to delete habit' });
  }
}