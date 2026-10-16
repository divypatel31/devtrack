import { Request, Response } from 'express';
import * as habitService from '../services/habit.service';

const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

export async function listHabits(req: Request, res: Response): Promise<void> {
  try {
    const dateQuery = typeof req.query.date === 'string' ? req.query.date : undefined;
    if (dateQuery && !DATE_REGEX.test(dateQuery)) {
      res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
      return;
    }

    const habits = await habitService.getAllHabitsWithStats(dateQuery);
    res.status(200).json({ habits });
  } catch (error) {
    console.error('[HabitController] listHabits error:', error);
    res.status(500).json({ error: 'Failed to fetch habits' });
  }
}

export async function createNewHabit(req: Request, res: Response): Promise<void> {
  try {
    const { title, category, targetDaysPerWeek } = req.body;

    if (!title || typeof title !== 'string' || title.trim().length === 0) {
      res.status(400).json({ error: 'Habit title is required.' });
      return;
    }

    const parsedTarget =
      targetDaysPerWeek !== undefined ? Number(targetDaysPerWeek) : 7;

    if (Number.isNaN(parsedTarget) || parsedTarget < 1 || parsedTarget > 7) {
      res.status(400).json({ error: 'targetDaysPerWeek must be between 1 and 7.' });
      return;
    }

    const habit = await habitService.createHabit({
      title,
      category: typeof category === 'string' ? category : 'General',
      targetDaysPerWeek: parsedTarget,
    });

    res.status(201).json({ habit });
  } catch (error) {
    console.error('[HabitController] createNewHabit error:', error);
    res.status(500).json({ error: 'Failed to create habit' });
  }
}

export async function toggleHabit(req: Request, res: Response): Promise<void> {
  try {
    const habitId = String(req.params.id);
    const { date } = req.body;

    if (date !== undefined && (typeof date !== 'string' || !DATE_REGEX.test(date))) {
      res.status(400).json({ error: 'Invalid date format. Expected YYYY-MM-DD.' });
      return;
    }

    const result = await habitService.toggleHabitCompletion(habitId, date);
    res.status(200).json(result);
  } catch (error) {
    console.error('[HabitController] toggleHabit error:', error);
    res.status(500).json({ error: 'Failed to toggle habit completion' });
  }
}

export async function removeHabit(req: Request, res: Response): Promise<void> {
  try {
    const habitId = String(req.params.id);
    await habitService.deleteHabit(habitId);
    res.status(200).json({ deleted: true, id: habitId });
  } catch (error) {
    console.error('[HabitController] removeHabit error:', error);
    res.status(500).json({ error: 'Failed to delete habit' });
  }
}