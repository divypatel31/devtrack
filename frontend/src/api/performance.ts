import { getAuthHeaders, clearAuthSession } from './auth';
import { getLocalTimezoneOffsetMinutes } from './habits';
import type {
  ActivityRecord,
  PerformanceGoal,
  ProviderStatuses,
  UnifiedPerformanceSummary,
} from '../types/performance';

const API_BASE_URL = import.meta.env.VITE_API_BASE_URL || 'http://localhost:4000/api';

function checkAuth(status: number): void {
  if (status === 401) {
    clearAuthSession();
  }
}

export async function fetchPerformanceSummary(
  todayStr: string
): Promise<{ summary: UnifiedPerformanceSummary; providers: ProviderStatuses }> {
  const tzOffset = getLocalTimezoneOffsetMinutes();
  const params = new URLSearchParams({
    date: todayStr,
    tzOffset: String(tzOffset),
  });
  const res = await fetch(`${API_BASE_URL}/performance/summary?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load performance summary (${res.status})`);
  }
  return res.json();
}

export async function fetchActivities(
  domain?: string,
  evidenceClass?: string
): Promise<ActivityRecord[]> {
  const params = new URLSearchParams();
  if (domain) params.set('domain', domain);
  if (evidenceClass) params.set('evidenceClass', evidenceClass);
  const res = await fetch(`${API_BASE_URL}/performance/activities?${params.toString()}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load activities (${res.status})`);
  }
  const data = await res.json();
  return data.activities || [];
}

export async function createActivity(payload: {
  domain: string;
  activityType: string;
  title: string;
  localDate: string;
  goalId?: string;
  durationMinutes?: number;
  distanceMeters?: number;
  movingTimeSeconds?: number;
  elevationGainMeters?: number;
  avgHeartRate?: number;
  quantity?: number;
  unit?: string;
  evidenceUrl?: string;
  evidenceNote?: string;
}): Promise<ActivityRecord> {
  const res = await fetch(`${API_BASE_URL}/performance/activities`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({
      ...payload,
      timezoneOffsetMinutes: getLocalTimezoneOffsetMinutes(),
    }),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to log activity (${res.status})`);
  }
  const data = await res.json();
  return data.activity;
}

export async function deleteActivity(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/performance/activities/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete activity (${res.status})`);
  }
}

export async function fetchGoals(domain?: string): Promise<PerformanceGoal[]> {
  const query = domain ? `?domain=${encodeURIComponent(domain)}` : '';
  const res = await fetch(`${API_BASE_URL}/performance/goals${query}`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to load goals (${res.status})`);
  }
  const data = await res.json();
  return data.goals || [];
}

export async function createGoal(payload: {
  domain: string;
  title: string;
  metricType: string;
  targetValue: number;
  unit: string;
  startDate: string;
  targetDate?: string;
}): Promise<PerformanceGoal> {
  const res = await fetch(`${API_BASE_URL}/performance/goals`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify(payload),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to create goal (${res.status})`);
  }
  const data = await res.json();
  return data.goal;
}

export async function deleteGoal(id: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/performance/goals/${id}`, {
    method: 'DELETE',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to delete goal (${res.status})`);
  }
}

export async function initiateStravaConnect(): Promise<{
  configured: boolean;
  authorizationUrl: string | null;
  state: string;
  message?: string;
}> {
  const res = await fetch(`${API_BASE_URL}/performance/providers/strava/connect`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to initiate Strava connection');
  }
  return res.json();
}

export async function completeStravaCallback(code: string, state: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/performance/providers/strava/callback`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ code, state }),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to complete Strava connection');
  }
}

export async function syncStravaActivitiesApi(): Promise<{ syncedCount: number }> {
  const res = await fetch(`${API_BASE_URL}/performance/providers/strava/sync`, {
    method: 'POST',
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Strava synchronization failed');
  }
  return res.json();
}

export async function initiateGitHubConnect(): Promise<{
  configured: boolean;
  authorizationUrl: string | null;
  state: string;
  message?: string;
}> {
  const res = await fetch(`${API_BASE_URL}/performance/providers/github/connect`, {
    headers: getAuthHeaders(),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to initiate GitHub OAuth connection');
  }
  return res.json();
}

export async function completeGitHubCallback(code: string, state: string): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/performance/providers/github/callback`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ code, state }),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'Failed to complete GitHub OAuth connection');
  }
}

export async function syncGitHubEventsApi(): Promise<{
  username: string;
  syncedCount: number;
}> {
  const res = await fetch(`${API_BASE_URL}/performance/providers/github/sync`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({}),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || 'GitHub synchronization failed');
  }
  return res.json();
}

export async function disconnectProviderApi(
  provider: 'STRAVA' | 'GITHUB',
  deleteActivities = false
): Promise<void> {
  const res = await fetch(`${API_BASE_URL}/performance/providers/${provider}/disconnect`, {
    method: 'POST',
    headers: getAuthHeaders({ 'Content-Type': 'application/json' }),
    body: JSON.stringify({ deleteActivities }),
  });
  if (!res.ok) {
    checkAuth(res.status);
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `Failed to disconnect ${provider}`);
  }
}