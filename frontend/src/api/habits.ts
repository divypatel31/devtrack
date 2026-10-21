import type { Habit, CreateHabitPayload } from '../types/habit';
import { getAuthHeaders, clearAuthSession } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

function handleUnauthorized(status: number): void {
  if (status === 401) {
    clearAuthSession();
  }
}

export async function fetchHabits(date?: string): Promise<Habit[]> {
  const query = date ? `?date=${encodeURIComponent(date)}` : '';
  const response = await fetch(`${API_BASE_URL}/habits${query}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to load habits (${response.status})`);
  }
  const data = await response.json();
  return data.habits;
}

export async function createHabit(payload: CreateHabitPayload): Promise<Habit> {
  const response = await fetch(`${API_BASE_URL}/habits`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to create habit (${response.status})`);
  }
  const data = await response.json();
  return data.habit;
}

export async function toggleHabitDate(
  habitId: string,
  date: string,
  today: string,
  note?: string
): Promise<{ habitId: string; completedDate: string; completed: boolean; note: string | null }> {
  const response = await fetch(`${API_BASE_URL}/habits/${habitId}/toggle`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ date, today, note }),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to toggle habit (${response.status})`);
  }
  return response.json();
}

export async function verifyLeetCodeHabit(
  habitId: string,
  today: string
): Promise<{ completed: boolean; solvedTodayCount: number; message: string }> {
  const response = await fetch(`${API_BASE_URL}/habits/${habitId}/verify-leetcode`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ today }),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `LeetCode verification failed (${response.status})`);
  }
  return response.json();
}

export async function deleteHabit(habitId: string): Promise<void> {
  const response = await fetch(`${API_BASE_URL}/habits/${habitId}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to delete habit (${response.status})`);
  }
}