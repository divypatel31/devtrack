import { Request, Response } from 'express';
import * as habitService from '../services/habit.service';
import { AppError, isValidCalendarDate } from '../services/habit.service';

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

    const habits = await habitService.getAllHabitsWithStats(req.user.id, dateQuery);
    res.status(200).json({ habits });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[HabitController] listHabits error:', error);
    res.status(500).json({ error: 'Failed to fetch habits' });
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
    const { today } = req.body ?? {};

    if (today !== undefined && !isValidCalendarDate(today)) {
      res.status(400).json({ error: 'Invalid today format. Expected valid YYYY-MM-DD.' });
      return;
    }

    const result = await habitService.verifyLeetCodeHabit(req.user.id, habitId, today);
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