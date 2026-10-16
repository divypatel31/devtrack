import { useEffect, useState, useCallback } from 'react';
import { fetchBackendHealth, type HealthResponse } from './api/health';
import {
  fetchHabits,
  createHabit,
  toggleHabitDate,
  deleteHabit,
} from './api/habits';
import type { Habit, DailyProgress } from './types/habit';
import { WeeklyStreakChart } from './components/WeeklyStreakChart';
import { HabitCard } from './components/HabitCard';

function getLocalTodayStr(): string {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function recalculateStreakFromWeek(weeklyProgress: DailyProgress[]): number {
  let streak = 0;
  const lastIdx = weeklyProgress.length - 1;
  if (lastIdx < 0) return 0;

  let cursor = lastIdx;
  if (!weeklyProgress[cursor].completed) {
    cursor -= 1;
  }
  while (cursor >= 0 && weeklyProgress[cursor].completed) {
    streak++;
    cursor--;
  }
  return streak;
}

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('DSA');
  const [submitting, setSubmitting] = useState<boolean>(false);
  const [togglingDate, setTogglingDate] = useState<string | null>(null);

  const todayStr = getLocalTodayStr();

  const loadDashboard = useCallback(async () => {
    try {
      const [healthData, habitsData] = await Promise.all([
        fetchBackendHealth(),
        fetchHabits(todayStr),
      ]);
      setHealth(healthData);
      setHabits(habitsData);
      setError(null);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to connect to server');
    } finally {
      setLoading(false);
    }
  }, [todayStr]);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  async function handleCreateHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    try {
      await createHabit({
        title: newTitle.trim(),
        category: newCategory,
        targetDaysPerWeek: 7,
      });
      setNewTitle('');
      setShowAddForm(false);
      const updated = await fetchHabits(todayStr);
      setHabits(updated);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleDate(habitId: string, date: string) {
    const previousHabits = habits;

    // 1. Instant Optimistic UI Update (0ms latency)
    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const updatedWeek = h.weeklyProgress.map((d) =>
          d.date === date ? { ...d, completed: !d.completed } : d
        );
        const completedToday =
          updatedWeek[updatedWeek.length - 1]?.completed ?? h.completedToday;
        const currentStreak = recalculateStreakFromWeek(updatedWeek);
        return {
          ...h,
          weeklyProgress: updatedWeek,
          completedToday,
          currentStreak,
        };
      })
    );

    // 2. Sync with Neon PostgreSQL in background
    setTogglingDate(`${habitId}:${date}`);
    try {
      await toggleHabitDate(habitId, date);
      const synced = await fetchHabits(todayStr);
      setHabits(synced);
      setError(null);
    } catch (err) {
      setHabits(previousHabits);
      setError(err instanceof Error ? err.message : 'Failed to sync habit toggle');
    } finally {
      setTogglingDate(null);
    }
  }

  async function handleDeleteHabit(habitId: string) {
    const previousHabits = habits;
    setHabits((prev) => prev.filter((h) => h.id !== habitId));
    try {
      await deleteHabit(habitId);
    } catch (err) {
      setHabits(previousHabits);
      setError(err instanceof Error ? err.message : 'Failed to delete habit');
    }
  }

  const isConnected = health?.status === 'ok';
  const completedTodayCount = habits.filter((h) => h.completedToday).length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.currentStreak), 0);

  return (
    <main className="mobile-shell">
      <header className="app-header">
        <div>
          <h1 className="app-title">DevTrack</h1>
          <p style={{ fontSize: '0.73rem', color: '#94a3b8' }}>
            {todayStr} • Daily Developer Growth
          </p>
        </div>
        <span className={`status-badge ${isConnected ? 'status-online' : 'status-offline'}`}>
          ● {loading ? 'Syncing...' : isConnected ? 'DB Online' : 'Offline'}
        </span>
      </header>

      {error && (
        <div
          className="card"
          style={{ borderColor: '#ef4444', color: '#fca5a5', fontSize: '0.82rem' }}
        >
          ⚠️ {error}
        </div>
      )}

      {/* Top Mobile KPI Summary */}
      <section className="summary-grid">
        <div className="summary-box">
          <div className="summary-value">
            {completedTodayCount}/{habits.length}
          </div>
          <div className="summary-label">Today Done</div>
        </div>
        <div className="summary-box">
          <div className="summary-value" style={{ color: '#fbbf24' }}>
            🔥 {bestStreak}d
          </div>
          <div className="summary-label">Best Streak</div>
        </div>
        <div className="summary-box">
          <div className="summary-value" style={{ color: '#38bdf8' }}>
            {habits.length}
          </div>
          <div className="summary-label">Active Goals</div>
        </div>
      </section>

      {/* Weekly Streak Bar Chart */}
      <WeeklyStreakChart habits={habits} />

      {/* Daily Goals Header + Quick Add */}
      <div className="section-bar">
        <h2 className="card-title">Daily Developer Goals</h2>
        <button
          type="button"
          className="primary-btn"
          onClick={() => setShowAddForm((prev) => !prev)}
        >
          {showAddForm ? 'Cancel' : '+ New Goal'}
        </button>
      </div>

      {showAddForm && (
        <section className="card">
          <form className="habit-form" onSubmit={handleCreateHabit}>
            <input
              type="text"
              className="input-field"
              placeholder="e.g., Solve 1 LeetCode Medium, Push 1 Commit..."
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              autoFocus
            />
            <div className="form-row">
              <select
                className="select-field"
                value={newCategory}
                onChange={(e) => setNewCategory(e.target.value)}
              >
                <option value="DSA">DSA & Algorithms</option>
                <option value="Full-Stack">Full-Stack Dev</option>
                <option value="System Design">System Design</option>
                <option value="Cybersecurity">Cybersecurity</option>
                <option value="General">General Coding</option>
              </select>
              <button type="submit" className="primary-btn" disabled={submitting}>
                {submitting ? 'Saving...' : 'Add Goal'}
              </button>
            </div>
          </form>
        </section>
      )}

      {/* Habit List */}
      {loading ? (
        <section className="card">
          <p style={{ fontSize: '0.85rem', color: '#94a3b8' }}>
            Loading your habits from Neon PostgreSQL...
          </p>
        </section>
      ) : habits.length === 0 ? (
        <section className="card" style={{ textAlign: 'center', padding: '1.75rem 1rem' }}>
          <p style={{ fontSize: '0.9rem', marginBottom: '0.4rem', fontWeight: 600 }}>
            No daily goals logged yet
          </p>
          <p style={{ fontSize: '0.78rem', color: '#94a3b8', marginBottom: '1rem' }}>
            Tap "+ New Goal" above to start tracking your daily coding consistency!
          </p>
        </section>
      ) : (
        <div className="habit-list">
          {habits.map((habit) => (
            <HabitCard
              key={habit.id}
              habit={habit}
              togglingDate={togglingDate}
              onToggleDate={handleToggleDate}
              onDelete={handleDeleteHabit}
            />
          ))}
        </div>
      )}
    </main>
  );
}

export default App;