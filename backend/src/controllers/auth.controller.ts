import { Request, Response } from 'express';
import * as authService from '../services/auth.service';
import { AppError } from '../services/habit.service';

export async function register(req: Request, res: Response): Promise<void> {
  try {
    const { email, name, password } = req.body ?? {};
    const result = await authService.registerUser({ email, name, password });
    res.status(201).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[AuthController] register error:', error);
    res.status(500).json({ error: 'Registration failed.' });
  }
}

export async function login(req: Request, res: Response): Promise<void> {
  try {
    const { email, password } = req.body ?? {};
    const result = await authService.loginUser({ email, password });
    res.status(200).json(result);
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    console.error('[AuthController] login error:', error);
    res.status(500).json({ error: 'Authentication failed.' });
  }
}

export async function me(req: Request, res: Response): Promise<void> {
  try {
    if (!req.user?.id) {
      res.status(401).json({ error: 'Authentication required.' });
      return;
    }
    const user = await authService.getUserProfile(req.user.id);
    res.status(200).json({ user });
  } catch (error) {
    if (error instanceof AppError) {
      res.status(error.statusCode).json({ error: error.message });
      return;
    }
    res.status(500).json({ error: 'Failed to load user profile.' });
  }
}