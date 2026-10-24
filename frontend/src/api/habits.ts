import type {
  Habit,
  CreateHabitPayload,
  UpdateHabitPayload,
  UserHabitAnalytics,
  MonthlyCalendarResponse,
} from '../types/habit';
import { getAuthHeaders, clearAuthSession } from './auth';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

function handleUnauthorized(status: number): void {
  if (status === 401) {
    clearAuthSession();
  }
}

export function getLocalTimezoneOffsetMinutes(): number {
  return -new Date().getTimezoneOffset();
}

export async function fetchHabitsWithAnalytics(
  date?: string,
  includeArchived = false
): Promise<{ habits: Habit[]; analytics: UserHabitAnalytics | null }> {
  const tzOffset = getLocalTimezoneOffsetMinutes();
  const params = new URLSearchParams();
  if (date) params.set('date', date);
  params.set('tzOffset', String(tzOffset));
  if (includeArchived) params.set('includeArchived', 'true');

  const response = await fetch(`${API_BASE_URL}/habits?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to load habits (${response.status})`);
  }
  const data = await response.json();
  return {
    habits: data.habits || [],
    analytics: data.analytics || null,
  };
}

export async function fetchMonthlyCalendar(
  month: string,
  todayStr: string,
  habitId?: string
): Promise<MonthlyCalendarResponse> {
  const tzOffset = getLocalTimezoneOffsetMinutes();
  const params = new URLSearchParams({
    month,
    date: todayStr,
    tzOffset: String(tzOffset),
  });
  if (habitId) {
    params.set('habitId', habitId);
  }

  const response = await fetch(`${API_BASE_URL}/habits/calendar?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to load calendar (${response.status})`);
  }
  const data = await response.json();
  return data.calendar as MonthlyCalendarResponse;
}

export async function fetchHabits(date?: string): Promise<Habit[]> {
  const { habits } = await fetchHabitsWithAnalytics(date);
  return habits;
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

export async function updateHabit(
  habitId: string,
  payload: UpdateHabitPayload
): Promise<Habit> {
  const response = await fetch(`${API_BASE_URL}/habits/${habitId}`, {
    method: 'PATCH',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!response.ok) {
    handleUnauthorized(response.status);
    const errBody = await response.json().catch(() => ({}));
    throw new Error(errBody.error || `Failed to update habit (${response.status})`);
  }
  const data = await response.json();
  return data.habit;
}

export async function toggleHabitDate(
  habitId: string,
  date: string,
  today: string,
  note?: string
): Promise<{
  habitId: string;
  completedDate: string;
  completed: boolean;
  note: string | null;
  currentStreak: number;
  longestStreak: number;
}> {
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
): Promise<{
  completed: boolean;
  solvedTodayCount: number;
  currentStreak: number;
  longestStreak: number;
  message: string;
}> {
  const response = await fetch(`${API_BASE_URL}/habits/${habitId}/verify-leetcode`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      today,
      timezoneOffsetMinutes: getLocalTimezoneOffsetMinutes(),
    }),
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