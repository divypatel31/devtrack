import { useEffect, useState, useCallback } from 'react';
import { fetchBackendHealth, type HealthResponse } from './api/health';
import {
  fetchHabits,
  createHabit,
  toggleHabitDate,
  verifyLeetCodeHabit,
  deleteHabit,
} from './api/habits';
import type { Habit, DailyProgress } from './types/habit';

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

const PRESET_GOALS = [
  {
    title: 'Solve 1 LeetCode Problem',
    category: 'DSA',
    verificationType: 'LEETCODE' as const,
    dailyTargetCount: 1,
  },
  {
    title: 'Solve 2 LeetCode Problems',
    category: 'DSA',
    verificationType: 'LEETCODE' as const,
    dailyTargetCount: 2,
  },
  {
    title: 'Push 1 GitHub Commit',
    category: 'Full-Stack',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
  },
  {
    title: 'Read System Design (30m)',
    category: 'System Design',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
  },
  {
    title: 'Complete 1 TryHackMe Room',
    category: 'Cybersecurity',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
  },
];

function App() {
  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Navigation & Notification Bell Dropdown
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [showNotifications, setShowNotifications] = useState<boolean>(false);

  // Create Goal Form State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('DSA');
  const [verificationType, setVerificationType] = useState<'MANUAL_PROOF' | 'LEETCODE'>('LEETCODE');
  const [leetcodeUsername, setLeetcodeUsername] = useState<string>('divypatel31');
  const [dailyTargetCount, setDailyTargetCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Proof input active per habit ID
  const [proofInputHabitId, setProofInputHabitId] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState<string>('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

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
    setError(null);
    try {
      await createHabit({
        title: newTitle.trim(),
        category: newCategory,
        targetDaysPerWeek: 7,
        verificationType,
        leetcodeUsername: verificationType === 'LEETCODE' ? leetcodeUsername.trim() : undefined,
        dailyTargetCount,
      });
      setNewTitle('');
      setShowAddForm(false);
      const updated = await fetchHabits(todayStr);
      setHabits(updated);
      setSuccessMsg('New developer goal created! Complete or sync it today to build your streak.');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleToggleManual(habitId: string) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (habit.verificationType === 'LEETCODE') {
      setError('Anti-Cheat: LeetCode goals cannot be manually clicked. Click "Sync LC" to auto-verify!');
      return;
    }

    if (!habit.completedToday) {
      setProofInputHabitId(habitId);
      setProofNote('');
      setError(null);
      return;
    }

    await executeToggle(habitId, '');
  }

  async function executeToggle(habitId: string, noteStr: string) {
    const previousHabits = habits;
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    const isCurrentlyDone = habit.completedToday;
    const nextCompletedState = !isCurrentlyDone;

    if (nextCompletedState && noteStr.trim().length < 4) {
      setError('Proof required: Please enter a brief work summary or commit link (min 4 chars).');
      return;
    }

    setHabits((prev) =>
      prev.map((h) => {
        if (h.id !== habitId) return h;
        const updatedWeek = h.weeklyProgress.map((d, idx) =>
          idx === h.weeklyProgress.length - 1
            ? { ...d, completed: nextCompletedState, note: nextCompletedState ? noteStr : null }
            : d
        );
        const currentStreak = recalculateStreakFromWeek(updatedWeek);
        return {
          ...h,
          weeklyProgress: updatedWeek,
          completedToday: nextCompletedState,
          currentStreak,
          todayNote: nextCompletedState ? noteStr : null,
        };
      })
    );

    setProofInputHabitId(null);
    try {
      await toggleHabitDate(habitId, todayStr, todayStr, noteStr);
      const synced = await fetchHabits(todayStr);
      setHabits(synced);
      setError(null);
      setSuccessMsg(
        nextCompletedState ? 'Goal verified with proof and logged for today!' : 'Today’s log removed.'
      );
    } catch (err) {
      setHabits(previousHabits);
      setError(err instanceof Error ? err.message : 'Action failed');
    }
  }

  async function handleVerifyLeetCode(habitId: string) {
    setVerifyingId(habitId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await verifyLeetCodeHabit(habitId, todayStr);
      const updated = await fetchHabits(todayStr);
      setHabits(updated);

      if (res.completed) {
        setSuccessMsg(`✅ ${res.message}`);
      } else {
        setError(`🔔 Reminder: ${res.message}`);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('DevTrack • LeetCode Goal Pending', { body: res.message });
        }
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'LeetCode verification failed');
    } finally {
      setVerifyingId(null);
    }
  }

  async function handleEnableBrowserNotifications() {
    if (!('Notification' in window)) {
      setError('Browser notifications are not supported on this device.');
      return;
    }
    const perm = await Notification.requestPermission();
    if (perm === 'granted') {
      new Notification('DevTrack Notifications Enabled 🔔', {
        body: `You have ${pendingGoals.length} pending developer goals for ${todayStr}!`,
      });
      setSuccessMsg('Browser notifications enabled! We will alert you when goals are pending.');
    }
  }

  async function handleDelete(habitId: string) {
    try {
      await deleteHabit(habitId);
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  const isDbOnline = health?.status === 'ok';
  const completedTodayCount = habits.filter((h) => h.completedToday).length;
  const pendingGoals = habits.filter((h) => !h.completedToday);
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.currentStreak), 0);
  const totalGoals = habits.length;
  const completionRate = totalGoals > 0 ? Math.round((completedTodayCount / totalGoals) * 100) : 0;

  const filteredHabits =
    activeFilter === 'ALL'
      ? habits
      : activeFilter === 'LEETCODE'
      ? habits.filter((h) => h.verificationType === 'LEETCODE')
      : habits.filter((h) => h.category === activeFilter);

  const daysList = habits[0]?.weeklyProgress.map((d) => d.date) || [];
  const dailyStats = daysList.map((date, idx) => {
    const done = habits.reduce((acc, h) => {
      const p = h.weeklyProgress.find((x) => x.date === date);
      return acc + (p?.completed ? 1 : 0);
    }, 0);
    const pct = totalGoals > 0 ? Math.round((done / totalGoals) * 100) : 0;
    const isToday = idx === daysList.length - 1;
    const dayName = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
      weekday: 'short',
      timeZone: 'UTC',
    });
    return { date, dayName, done, pct, isToday };
  });

  return (
    <div className="app-layout">
      {/* Left Sidebar (Desktop) */}
      <aside className="sidebar">
        <div className="sidebar-logo">⚡ DevTrack</div>
        <nav className="sidebar-nav">
          <button
            type="button"
            className={`nav-item ${activeFilter === 'ALL' ? 'nav-item-active' : ''}`}
            onClick={() => setActiveFilter('ALL')}
          >
            📊 Dashboard ({totalGoals})
          </button>
          <button
            type="button"
            className={`nav-item ${activeFilter === 'DSA' ? 'nav-item-active' : ''}`}
            onClick={() => setActiveFilter('DSA')}
          >
            🧠 DSA & Algorithms
          </button>
          <button
            type="button"
            className={`nav-item ${activeFilter === 'Full-Stack' ? 'nav-item-active' : ''}`}
            onClick={() => setActiveFilter('Full-Stack')}
          >
            💻 Full-Stack Dev
          </button>
          <button
            type="button"
            className={`nav-item ${activeFilter === 'Cybersecurity' ? 'nav-item-active' : ''}`}
            onClick={() => setActiveFilter('Cybersecurity')}
          >
            🛡️ Cybersecurity
          </button>

          <div className="sidebar-section-title">Integrations</div>
          <button
            type="button"
            className={`nav-item ${activeFilter === 'LEETCODE' ? 'nav-item-active' : ''}`}
            onClick={() => setActiveFilter('LEETCODE')}
          >
            🟢 LeetCode Auto-Sync
          </button>
        </nav>

        <div
          style={{
            padding: '0.75rem',
            borderRadius: '0.75rem',
            backgroundColor: '#0b0c10',
            border: '1px solid #1e2230',
            fontSize: '0.75rem',
            color: isDbOnline ? '#34d399' : '#f87171',
          }}
        >
          ● {loading ? 'Connecting...' : isDbOnline ? 'Neon PostgreSQL Online' : 'Database Offline'}
        </div>
      </aside>

      {/* Main Content */}
      <main className="main-content">
        {/* Top Greeting Header */}
        <header className="top-header">
          <div>
            <h1 className="greeting-title">Hi, Divy! 👋</h1>
            <p className="greeting-subtitle">
              {todayStr} • Verified Developer Consistency & LeetCode Tracker
            </p>
          </div>
          <div className="top-actions">
            {/* Notification Bell with Unfinished Goal Reminders */}
            <div className="notification-wrapper">
              <button
                type="button"
                className="notification-btn"
                onClick={() => setShowNotifications((prev) => !prev)}
                title="Pending Goal Notifications"
              >
                🔔
                {pendingGoals.length > 0 && <span className="notification-badge" />}
              </button>

              {showNotifications && (
                <div className="notification-dropdown">
                  <div
                    style={{
                      display: 'flex',
                      justifyContent: 'space-between',
                      alignItems: 'center',
                      marginBottom: '0.65rem',
                    }}
                  >
                    <strong style={{ fontSize: '0.82rem' }}>
                      🔔 Today's Reminders ({pendingGoals.length})
                    </strong>
                    <button
                      type="button"
                      className="secondary-btn"
                      onClick={handleEnableBrowserNotifications}
                    >
                      Alert Me
                    </button>
                  </div>
                  {pendingGoals.length === 0 ? (
                    <p style={{ fontSize: '0.78rem', color: '#34d399' }}>
                      🎉 All developer goals verified for today!
                    </p>
                  ) : (
                    pendingGoals.map((g) => (
                      <div key={g.id} className="notif-item">
                        <div style={{ fontWeight: 700, color: '#f8fafc' }}>{g.title}</div>
                        <div style={{ color: '#94a3b8', marginTop: '0.2rem' }}>
                          {g.verificationType === 'LEETCODE'
                            ? `⚡ Solve ${g.dailyTargetCount} on LeetCode (@${g.leetcodeUsername}) & click Sync LC`
                            : '📝 Pending manual proof note for today'}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              )}
            </div>

            <button
              type="button"
              className="primary-btn"
              onClick={() => setShowAddForm((prev) => !prev)}
            >
              {showAddForm ? '✕ Close' : '+ Create Goal'}
            </button>
          </div>
        </header>

        {error && (
          <div
            style={{
              backgroundColor: 'rgba(239, 68, 68, 0.12)',
              border: '1px solid #ef4444',
              color: '#fca5a5',
              marginBottom: '1.25rem',
              padding: '0.9rem 1rem',
              borderRadius: '0.75rem',
              fontSize: '0.84rem',
            }}
          >
            ⚠️ {error}
          </div>
        )}

        {successMsg && (
          <div
            style={{
              backgroundColor: 'rgba(16, 185, 129, 0.12)',
              border: '1px solid #10b981',
              color: '#34d399',
              marginBottom: '1.25rem',
              padding: '0.9rem 1rem',
              borderRadius: '0.75rem',
              fontSize: '0.84rem',
            }}
          >
            {successMsg}
          </div>
        )}

        {/* Bento 3-Column Analytics Row */}
        <section className="bento-analytics-grid">
          {/* 1. Overall Information (Matches Reference Image Vibrant Stat Boxes) */}
          <div className="bento-card">
            <h2 className="bento-card-title">Overall Information</h2>
            <div className="overall-stats-row">
              <div className="overall-stat-item">
                <h3>
                  {completedTodayCount}/{totalGoals}
                </h3>
                <p>Verified Today</p>
              </div>
              <div className="overall-stat-item">
                <h3 style={{ color: '#fbbf24' }}>🔥 {bestStreak}d</h3>
                <p>Best Streak</p>
              </div>
            </div>

            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(3, 1fr)',
                gap: '0.5rem',
                marginTop: '0.5rem',
              }}
            >
              <div
                style={{
                  background: '#5b4dff',
                  padding: '0.65rem',
                  borderRadius: '0.75rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{totalGoals}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>Total Goals</div>
              </div>
              <div
                style={{
                  background: '#ec4899',
                  padding: '0.65rem',
                  borderRadius: '0.75rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{pendingGoals.length}</div>
                <div style={{ fontSize: '0.65rem', opacity: 0.9 }}>In Progress</div>
              </div>
              <div
                style={{
                  background: '#eab308',
                  color: '#0b0c10',
                  padding: '0.65rem',
                  borderRadius: '0.75rem',
                  textAlign: 'center',
                }}
              >
                <div style={{ fontSize: '1.15rem', fontWeight: 800 }}>{completedTodayCount}</div>
                <div style={{ fontSize: '0.65rem', fontWeight: 700 }}>Completed</div>
              </div>
            </div>
          </div>

          {/* 2. Weekly Progress */}
          <div className="bento-card">
            <div className="weekly-chart-header">
              <h2 className="bento-card-title" style={{ margin: 0 }}>
                Weekly Progress
              </h2>
              <span className="consistency-tag">{completionRate}% today</span>
            </div>
            <div className="weekly-bars-grid">
              {dailyStats.map((st) => (
                <div key={st.date} className="weekly-bar-col">
                  <span style={{ fontSize: '0.62rem', color: '#64748b' }}>
                    {st.done}/{totalGoals}
                  </span>
                  <div className="weekly-bar-track">
                    <div
                      className={`weekly-bar-fill ${
                        st.pct === 100 ? 'weekly-bar-fill-complete' : ''
                      }`}
                      style={{ height: `${Math.max(st.pct, 8)}%` }}
                    />
                  </div>
                  <span
                    className="weekly-bar-label"
                    style={st.isToday ? { color: '#38bdf8', fontWeight: 800 } : undefined}
                  >
                    {st.dayName}
                  </span>
                </div>
              ))}
            </div>
          </div>

          {/* 3. Verification & Category Breakdown */}
          <div className="bento-card">
            <h2 className="bento-card-title">Verification Modes</h2>
            <div className="category-stats-list">
              <div className="category-row">
                <span>🟢 LeetCode Auto-Verified</span>
                <span style={{ color: '#34d399', fontWeight: 700 }}>
                  {habits.filter((h) => h.verificationType === 'LEETCODE').length} goals
                </span>
              </div>
              <div className="category-row">
                <span>📝 Proof-Locked Manual</span>
                <span style={{ color: '#38bdf8', fontWeight: 700 }}>
                  {habits.filter((h) => h.verificationType === 'MANUAL_PROOF').length} goals
                </span>
              </div>
              <div className="category-row">
                <span>🔒 Past-Date Anti-Cheat</span>
                <span style={{ color: '#fbbf24', fontWeight: 700 }}>Active</span>
              </div>
            </div>
          </div>
        </section>

        {/* Create Developer Goal Drawer with Presets */}
        {showAddForm && (
          <section className="modal-card">
            <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.85rem' }}>
              <h2 className="section-title">Select a Developer Goal Preset or Write Custom</h2>
              <button type="button" className="secondary-btn" onClick={() => setShowAddForm(false)}>
                ✕ Close
              </button>
            </div>

            <p style={{ fontSize: '0.76rem', color: '#94a3b8', marginBottom: '0.5rem' }}>
              ⚡ 1-Click Developer Goal Templates (click to autofill):
            </p>
            <div className="presets-row">
              {PRESET_GOALS.map((p) => (
                <button
                  key={p.title}
                  type="button"
                  className="preset-chip"
                  onClick={() => {
                    setNewTitle(p.title);
                    setNewCategory(p.category);
                    setVerificationType(p.verificationType);
                    setDailyTargetCount(p.dailyTargetCount);
                  }}
                >
                  + {p.title}
                </button>
              ))}
            </div>

            <form onSubmit={handleCreateHabit}>
              <div className="form-grid">
                <input
                  type="text"
                  className="input-field"
                  placeholder="Or write custom goal (e.g., Solve 2 LeetCode Mediums)"
                  value={newTitle}
                  onChange={(e) => setNewTitle(e.target.value)}
                  required
                />
                <select
                  className="select-field"
                  value={newCategory}
                  onChange={(e) => setNewCategory(e.target.value)}
                >
                  <option value="DSA">DSA & LeetCode</option>
                  <option value="Full-Stack">Full-Stack Dev</option>
                  <option value="System Design">System Design</option>
                  <option value="Cybersecurity">Cybersecurity</option>
                  <option value="General">General</option>
                </select>
                <select
                  className="select-field"
                  value={verificationType}
                  onChange={(e) =>
                    setVerificationType(e.target.value as 'MANUAL_PROOF' | 'LEETCODE')
                  }
                >
                  <option value="LEETCODE">⚡ LeetCode Auto-Verify</option>
                  <option value="MANUAL_PROOF">📝 Manual (Requires Proof)</option>
                </select>
                <button type="submit" className="primary-btn" disabled={submitting}>
                  {submitting ? 'Saving...' : 'Create Goal'}
                </button>
              </div>

              {verificationType === 'LEETCODE' && (
                <div
                  style={{
                    marginTop: '0.75rem',
                    display: 'grid',
                    gridTemplateColumns: '1fr auto',
                    gap: '0.75rem',
                    alignItems: 'center',
                  }}
                >
                  <input
                    type="text"
                    className="input-field"
                    placeholder="Your LeetCode Username (e.g. divypatel31)"
                    value={leetcodeUsername}
                    onChange={(e) => setLeetcodeUsername(e.target.value)}
                    required
                  />
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
                    <span style={{ fontSize: '0.78rem', color: '#94a3b8' }}>Daily Problems:</span>
                    <input
                      type="number"
                      className="input-field"
                      style={{ width: '80px' }}
                      min={1}
                      max={10}
                      value={dailyTargetCount}
                      onChange={(e) => setDailyTargetCount(Number(e.target.value))}
                    />
                  </div>
                </div>
              )}
            </form>
          </section>
        )}

        {/* Goals List Header */}
        <div className="section-header-bar">
          <h2 className="section-title">
            Task In Process & Verified Goals ({filteredHabits.length})
          </h2>
          <span style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
            🔒 Past days are read-only (Anti-Cheat active)
          </span>
        </div>

        {/* Habit Cards Grid */}
        {loading ? (
          <div
            className="bento-card"
            style={{ padding: '2rem', textAlign: 'center', color: '#94a3b8' }}
          >
            Loading Bento Dashboard...
          </div>
        ) : filteredHabits.length === 0 ? (
          <div className="bento-card" style={{ padding: '2.5rem', textAlign: 'center' }}>
            <p style={{ fontWeight: 700, marginBottom: '0.4rem' }}>No developer goals in this view</p>
            <p style={{ fontSize: '0.82rem', color: '#94a3b8' }}>
              Click "+ Create Goal" above and pick a LeetCode or Developer preset!
            </p>
          </div>
        ) : (
          <div className="habits-grid">
            {filteredHabits.map((habit) => {
              const isProofOpen = proofInputHabitId === habit.id;
              const isVerifyingThis = verifyingId === habit.id;

              return (
                <div
                  key={habit.id}
                  className={`habit-card ${habit.completedToday ? 'habit-card-done' : ''}`}
                >
                  <div>
                    <div className="habit-card-header">
                      <div>
                        <div className="habit-meta-badges">
                          <span className="badge-category">{habit.category}</span>
                          <span className="badge-streak">🔥 {habit.currentStreak}d streak</span>
                          <span className="badge-verification">
                            {habit.verificationType === 'LEETCODE'
                              ? '🟢 LeetCode Auto'
                              : '📝 Proof Required'}
                          </span>
                        </div>
                        <h3 className="habit-card-title">{habit.title}</h3>
                        {habit.verificationType === 'LEETCODE' && (
                          <p style={{ fontSize: '0.74rem', color: '#94a3b8', marginTop: '0.25rem' }}>
                            Account: <strong>@{habit.leetcodeUsername}</strong> • Target:{' '}
                            <strong>{habit.dailyTargetCount}/day</strong>
                          </p>
                        )}
                      </div>

                      <div className="action-btn-group">
                        {habit.verificationType === 'LEETCODE' ? (
                          <button
                            type="button"
                            className="primary-btn"
                            style={{
                              fontSize: '0.75rem',
                              padding: '0.5rem 0.8rem',
                              background: habit.completedToday
                                ? '#10b981'
                                : 'linear-gradient(135deg, #4f46e5, #0284c7)',
                            }}
                            disabled={isVerifyingThis}
                            onClick={() => handleVerifyLeetCode(habit.id)}
                          >
                            {isVerifyingThis
                              ? 'Syncing...'
                              : habit.completedToday
                              ? '✓ Verified'
                              : '🔄 Sync LC'}
                          </button>
                        ) : (
                          <button
                            type="button"
                            className={`check-action-btn ${
                              habit.completedToday ? 'check-action-btn-done' : ''
                            }`}
                            onClick={() => handleToggleManual(habit.id)}
                            title={
                              habit.completedToday
                                ? 'Verified for today (click to undo)'
                                : 'Submit proof for today'
                            }
                          >
                            {habit.completedToday ? '✓' : '+'}
                          </button>
                        )}
                      </div>
                    </div>

                    {/* Proof Input Drawer for Manual Goals */}
                    {isProofOpen && (
                      <div className="proof-input-box">
                        <p
                          style={{
                            fontSize: '0.74rem',
                            color: '#38bdf8',
                            marginBottom: '0.4rem',
                            fontWeight: 600,
                          }}
                        >
                          🔒 Anti-Cheat Proof Note (What did you build/study today?):
                        </p>
                        <input
                          type="text"
                          className="input-field"
                          placeholder="e.g. Pushed commit #a1b2c or Read Redis Streams docs..."
                          value={proofNote}
                          onChange={(e) => setProofNote(e.target.value)}
                          autoFocus
                        />
                        <div className="proof-row">
                          <button
                            type="button"
                            className="secondary-btn"
                            onClick={() => setProofInputHabitId(null)}
                          >
                            Cancel
                          </button>
                          <button
                            type="button"
                            className="small-btn"
                            onClick={() => executeToggle(habit.id, proofNote)}
                          >
                            Verify & Complete Today
                          </button>
                        </div>
                      </div>
                    )}

                    {habit.todayNote && !isProofOpen && (
                      <p
                        style={{
                          fontSize: '0.74rem',
                          color: '#34d399',
                          marginTop: '0.45rem',
                          background: 'rgba(16, 185, 129, 0.08)',
                          padding: '0.35rem 0.6rem',
                          borderRadius: '0.45rem',
                        }}
                      >
                        ✓ {habit.todayNote}
                      </p>
                    )}
                  </div>

                  {/* Read-Only 7-Day History Strip (Past Days Locked Against Cheating) */}
                  <div className="habit-card-footer">
                    <div className="mini-days-row">
                      {habit.weeklyProgress.map((day, idx) => {
                        const isToday = idx === habit.weeklyProgress.length - 1;
                        const dayLetter = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
                          'en-US',
                          { weekday: 'narrow', timeZone: 'UTC' }
                        );
                        return (
                          <div
                            key={day.date}
                            className={`mini-day-box ${day.completed ? 'mini-day-done' : ''}`}
                            title={
                              isToday
                                ? `Today (${day.date})`
                                : `${day.date} (Locked History): ${
                                    day.completed ? 'Verified' : 'Missed'
                                  }`
                            }
                            style={isToday ? { borderColor: '#6366f1' } : undefined}
                          >
                            <span style={{ fontWeight: 700 }}>{dayLetter}</span>
                            <span style={{ fontSize: '0.52rem' }}>
                              {day.completed ? '●' : isToday ? '◎' : '🔒'}
                            </span>
                          </div>
                        );
                      })}
                    </div>

                    <button
                      type="button"
                      className="delete-text-btn"
                      onClick={() => handleDelete(habit.id)}
                    >
                      Delete
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </main>

      {/* Mobile Sticky Bottom Navigation */}
      <nav className="mobile-bottom-nav">
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setActiveFilter('ALL')}
        >
          📊 All ({totalGoals})
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setActiveFilter('LEETCODE')}
        >
          🟢 LeetCode
        </button>
        <button
          type="button"
          className="primary-btn"
          style={{ padding: '0.4rem 0.85rem', fontSize: '0.76rem' }}
          onClick={() => setShowAddForm(true)}
        >
          + Goal
        </button>
        <button
          type="button"
          className="secondary-btn"
          onClick={() => setShowNotifications((prev) => !prev)}
        >
          🔔 ({pendingGoals.length})
        </button>
      </nav>
    </div>
  );
}

export default App;