import { useEffect, useState } from 'react';
import { motion, AnimatePresence, useReducedMotion } from 'framer-motion';
import {
  LayoutGrid,
  Calendar,
  BarChart3,
  Shield,
  Settings,
  Bell,
  Search,
  Plus,
  MoreHorizontal,
  Flame,
  Trophy,
  Lock,
  Check,
  RefreshCw,
  Sparkles,
  Code2,
  Cpu,
  Terminal,
  Trash2,
  Pin,
  Edit3,
  X,
  AlertCircle,
  CheckCircle2,
  LogOut,
  Archive,
  ArchiveRestore,
  ArrowRight,
} from 'lucide-react';
import { fetchBackendHealth, type HealthResponse } from './api/health';
import {
  getStoredToken,
  getStoredUser,
  loginUserApi,
  registerUserApi,
  clearAuthSession,
  type AuthUser,
} from './api/auth';
import {
  fetchHabitsWithAnalytics,
  createHabit,
  updateHabit,
  toggleHabitDate,
  verifyLeetCodeHabit,
  deleteHabit,
} from './api/habits';
import type { Habit, DailyProgress, UserHabitAnalytics } from './types/habit';
import { StatisticsView } from './components/StatisticsView';
import { SecurityLabsView } from './components/SecurityLabsView';
import { HabitCalendarView } from './components/HabitCalendarView';
import { PerformanceHubView } from './components/PerformanceHubView';
import { completeStravaCallback, completeGitHubCallback } from './api/performance';

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
    desc: 'Verified automatically via LeetCode GraphQL',
  },
  {
    title: 'Solve 2 LeetCode Problems',
    category: 'DSA',
    verificationType: 'LEETCODE' as const,
    dailyTargetCount: 2,
    desc: 'Steady daily algorithm problem-solving',
  },
  {
    title: 'Push 1 GitHub Commit',
    category: 'Full-Stack',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
    desc: 'Log a brief commit note or PR reference',
  },
  {
    title: 'Read System Design (30m)',
    category: 'System Design',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
    desc: 'Summarize the architecture concept you studied',
  },
  {
    title: 'Complete 1 TryHackMe Room',
    category: 'Cybersecurity',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
    desc: 'Record the lab room or key security takeaway',
  },
];

const WEEKDAY_NAMES = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function getCategoryIcon(category: string) {
  switch (category) {
    case 'DSA':
      return <Code2 className="w-5 h-5 text-indigo-600" />;
    case 'Full-Stack':
      return <Terminal className="w-5 h-5 text-violet-600" />;
    case 'System Design':
      return <Cpu className="w-5 h-5 text-amber-600" />;
    case 'Cybersecurity':
      return <Shield className="w-5 h-5 text-emerald-600" />;
    default:
      return <Sparkles className="w-5 h-5 text-indigo-600" />;
  }
}

export function App() {
  const prefersReducedMotion = useReducedMotion();

  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [analytics, setAnalytics] = useState<UserHabitAnalytics | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);
  const [reloadCounter, setReloadCounter] = useState<number>(0);

  const [activePage, setActivePage] = useState<
    'DASHBOARD' | 'PERFORMANCE' | 'CALENDAR' | 'STATISTICS' | 'SECURITY'
  >('DASHBOARD');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [showArchived, setShowArchived] = useState<boolean>(false);
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [openMenuHabitId, setOpenMenuHabitId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('DSA');
  const [verificationType, setVerificationType] = useState<'MANUAL_PROOF' | 'LEETCODE'>('LEETCODE');
  const [leetcodeUsername, setLeetcodeUsername] = useState<string>('divypatel31');
  const [dailyTargetCount, setDailyTargetCount] = useState<number>(1);
  const [scheduledDays, setScheduledDays] = useState<number[]>([0, 1, 2, 3, 4, 5, 6]);
  const [submitting, setSubmitting] = useState<boolean>(false);

  const [habitToDelete, setHabitToDelete] = useState<Habit | null>(null);
  const [deleting, setDeleting] = useState<boolean>(false);

  const [proofInputHabitId, setProofInputHabitId] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState<string>('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const todayStr = getLocalTodayStr();

  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') {
        setShowAddForm(false);
        setEditingHabit(null);
        setHabitToDelete(null);
        setOpenMenuHabitId(null);
        setShowNotifications(false);
      }
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  useEffect(() => {
    if (!authToken) return;
    const params = new URLSearchParams(window.location.search);
    if (params.get('strava_oauth') === 'callback' && params.get('code') && params.get('state')) {
      const code = params.get('code')!;
      const state = params.get('state')!;
      window.history.replaceState({}, '', window.location.pathname);
      completeStravaCallback(code, state)
        .then(() => {
          setSuccessMsg('Strava account connected. Click Sync Activities to import your workouts.');
          setActivePage('PERFORMANCE');
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'Strava connection could not be completed');
        });
    } else if (
      params.get('github_oauth') === 'callback' &&
      params.get('code') &&
      params.get('state')
    ) {
      const code = params.get('code')!;
      const state = params.get('state')!;
      window.history.replaceState({}, '', window.location.pathname);
      completeGitHubCallback(code, state)
        .then(() => {
          setSuccessMsg('GitHub account connected. Click Sync GitHub Events to import your activity.');
          setActivePage('PERFORMANCE');
        })
        .catch((err) => {
          setError(err instanceof Error ? err.message : 'GitHub connection could not be completed');
        });
    }
  }, [authToken]);

  useEffect(() => {
    let isCancelled = false;

    async function syncWorkspace() {
      setLoading(true);
      try {
        const healthData = await fetchBackendHealth();
        if (!isCancelled) {
          setHealth(healthData);
        }

        if (!authToken) {
          if (!isCancelled) {
            setHabits([]);
            setAnalytics(null);
            setLoading(false);
          }
          return;
        }

        const { habits: habitsData, analytics: analyticsData } =
          await fetchHabitsWithAnalytics(todayStr, showArchived);
        if (!isCancelled) {
          setHabits(habitsData);
          setAnalytics(analyticsData);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          if (!getStoredToken()) {
            setAuthToken(null);
            setCurrentUser(null);
          }
          setError(err instanceof Error ? err.message : 'Unable to reach server');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void syncWorkspace();

    return () => {
      isCancelled = true;
    };
  }, [authToken, todayStr, showArchived, reloadCounter]);

  async function refreshHabitsAndAnalytics() {
    const { habits: updated, analytics: updatedAnalytics } =
      await fetchHabitsWithAnalytics(todayStr, showArchived);
    setHabits(updated);
    setAnalytics(updatedAnalytics);
  }

  async function handleAuthSubmit(e: React.FormEvent) {
    e.preventDefault();
    setAuthSubmitting(true);
    setError(null);
    try {
      const res =
        authMode === 'LOGIN'
          ? await loginUserApi({ email: authEmail, password: authPassword })
          : await registerUserApi({ name: authName, email: authEmail, password: authPassword });

      setCurrentUser(res.user);
      setAuthToken(res.token);
      setAuthPassword('');
      setLoading(true);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Sign-in failed');
    } finally {
      setAuthSubmitting(false);
    }
  }

  function handleLogout() {
    clearAuthSession();
    setAuthToken(null);
    setCurrentUser(null);
    setHabits([]);
    setAnalytics(null);
    setSuccessMsg(null);
    setError(null);
  }

  function openCreateModal() {
    setEditingHabit(null);
    setNewTitle('');
    setNewCategory('DSA');
    setVerificationType('LEETCODE');
    setDailyTargetCount(1);
    setScheduledDays([0, 1, 2, 3, 4, 5, 6]);
    setShowAddForm(true);
  }

  function openEditModal(habit: Habit) {
    setOpenMenuHabitId(null);
    setEditingHabit(habit);
    setNewTitle(habit.title);
    setNewCategory(habit.category);
    setVerificationType(habit.verificationType);
    setLeetcodeUsername(habit.leetcodeUsername || 'divypatel31');
    setDailyTargetCount(habit.dailyTargetCount);
    setScheduledDays(
      habit.scheduledDays && habit.scheduledDays.length > 0
        ? habit.scheduledDays
        : [0, 1, 2, 3, 4, 5, 6]
    );
    setShowAddForm(true);
  }

  async function handleSaveHabit(e: React.FormEvent) {
    e.preventDefault();
    if (!newTitle.trim()) return;

    setSubmitting(true);
    setError(null);
    try {
      if (editingHabit) {
        await updateHabit(editingHabit.id, {
          title: newTitle.trim(),
          category: newCategory,
          scheduledDays,
          dailyTargetCount,
          leetcodeUsername:
            editingHabit.verificationType === 'LEETCODE' ? leetcodeUsername.trim() : undefined,
        });
        setSuccessMsg(`Saved changes to "${newTitle.trim()}".`);
      } else {
        await createHabit({
          title: newTitle.trim(),
          category: newCategory,
          targetDaysPerWeek: scheduledDays.length,
          scheduledDays,
          verificationType,
          leetcodeUsername: verificationType === 'LEETCODE' ? leetcodeUsername.trim() : undefined,
          dailyTargetCount,
        });
        setSuccessMsg(`Created habit "${newTitle.trim()}".`);
      }
      setNewTitle('');
      setEditingHabit(null);
      setShowAddForm(false);
      await refreshHabitsAndAnalytics();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to save habit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleArchiveToggle(habit: Habit) {
    setOpenMenuHabitId(null);
    setError(null);
    try {
      const nextArchived = !habit.isArchived;
      await updateHabit(habit.id, { isArchived: nextArchived });
      await refreshHabitsAndAnalytics();
      setSuccessMsg(
        nextArchived
          ? `Archived "${habit.title}". Your past completion history is preserved.`
          : `Restored "${habit.title}" to your active habits.`
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not update archive status');
    }
  }

  async function handleQuickCreateSecurityLab(title: string) {
    setError(null);
    try {
      await createHabit({
        title,
        category: 'Cybersecurity',
        targetDaysPerWeek: 7,
        scheduledDays: [0, 1, 2, 3, 4, 5, 6],
        verificationType: 'MANUAL_PROOF',
        dailyTargetCount: 1,
      });
      await refreshHabitsAndAnalytics();
      setSuccessMsg(`Added "${title}" to your habits.`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not create security habit');
    }
  }

  async function handleToggleManual(habitId: string) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (habit.isArchived) {
      setError('Restore this archived habit before checking in.');
      return;
    }

    if (habit.verificationType === 'LEETCODE') {
      setError('Use the "Sync" button on this card to verify your LeetCode submissions.');
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
      setError('Please enter a brief note or commit link (at least 4 characters) to check in.');
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
      await refreshHabitsAndAnalytics();
      setError(null);
      setSuccessMsg(
        nextCompletedState ? 'Check-in saved for today.' : 'Today\'s check-in was undone.'
      );
    } catch (err) {
      setHabits(previousHabits);
      setError(err instanceof Error ? err.message : 'Could not update check-in');
    }
  }

  async function handleVerifyLeetCode(habitId: string) {
    setVerifyingId(habitId);
    setError(null);
    setSuccessMsg(null);
    try {
      const res = await verifyLeetCodeHabit(habitId, todayStr);
      await refreshHabitsAndAnalytics();

      if (res.completed) {
        setSuccessMsg(res.message);
      } else {
        setError(res.message);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('DevTrack - LeetCode Reminder', { body: res.message });
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
      new Notification('DevTrack Reminders Enabled', {
        body: `You have ${pendingGoals.length} scheduled habits remaining for ${todayStr}.`,
      });
      setSuccessMsg('Browser reminders enabled.');
    }
  }

  async function confirmAndDeleteHabit() {
    if (!habitToDelete) return;
    setDeleting(true);
    try {
      await deleteHabit(habitToDelete.id);
      setHabitToDelete(null);
      await refreshHabitsAndAnalytics();
      setSuccessMsg(`Deleted "${habitToDelete.title}".`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unable to delete habit');
    } finally {
      setDeleting(false);
    }
  }

  function togglePin(habitId: string) {
    setOpenMenuHabitId(null);
    setPinnedIds((prev) =>
      prev.includes(habitId) ? prev.filter((id) => id !== habitId) : [habitId, ...prev]
    );
  }

  const isDbOnline = health?.status === 'ok';

  // AUTH GATE (Refined Light SaaS Experience)
  if (!authToken || !currentUser) {
    return (
      <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex items-center justify-center p-4">
        <motion.div
          initial={prefersReducedMotion ? false : { opacity: 0, y: 10 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-white border border-slate-200/90 rounded-2xl max-w-md w-full p-7 sm:p-8 shadow-sm"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-2.5">
              <div className="w-8 h-8 rounded-xl bg-indigo-600 flex items-center justify-center text-white font-bold text-sm shadow-2xs">
                D
              </div>
              <span className="text-lg font-extrabold tracking-tight text-slate-900">
                DevTrack
              </span>
            </div>
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full border ${
                isDbOnline
                  ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                  : 'bg-amber-50 text-amber-700 border-amber-200'
              }`}
            >
              {"\u25CF"} {isDbOnline ? 'System Online' : 'Connecting...'}
            </span>
          </div>

          <h1 className="text-xl sm:text-2xl font-extrabold text-slate-900 mb-1">
            {authMode === 'LOGIN' ? 'Welcome back' : 'Create your account'}
          </h1>
          <p className="text-xs sm:text-sm text-slate-500 mb-6">
            {authMode === 'LOGIN'
              ? 'Sign in to access your habits, streaks, and multi-domain performance log.'
              : 'Build consistent habits and measure real progress across code, fitness, and learning.'}
          </p>

          {error && (
            <div
              role="alert"
              className="mb-4 p-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs flex items-center gap-2"
            >
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-600" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'REGISTER' && (
              <div>
                <label
                  htmlFor="auth-name"
                  className="text-xs font-semibold text-slate-700 block mb-1.5"
                >
                  Full Name
                </label>
                <input
                  id="auth-name"
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Divy Patel"
                  required
                  className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
                />
              </div>
            )}

            <div>
              <label
                htmlFor="auth-email"
                className="text-xs font-semibold text-slate-700 block mb-1.5"
              >
                Email Address
              </label>
              <input
                id="auth-email"
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="you@example.com"
                required
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>

            <div>
              <label
                htmlFor="auth-password"
                className="text-xs font-semibold text-slate-700 block mb-1.5"
              >
                Password (8+ characters)
              </label>
              <input
                id="auth-password"
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="********"
                required
                minLength={8}
                className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full bg-indigo-600 hover:bg-indigo-700 disabled:opacity-60 text-white font-semibold text-sm py-2.5 rounded-xl shadow-xs transition cursor-pointer"
            >
              {authSubmitting
                ? 'Signing in...'
                : authMode === 'LOGIN'
                ? 'Sign In'
                : 'Create Account'}
            </button>
          </form>

          <div className="mt-6 pt-4 border-t border-slate-100 text-center">
            <button
              type="button"
              onClick={() => {
                setAuthMode((m) => (m === 'LOGIN' ? 'REGISTER' : 'LOGIN'));
                setError(null);
              }}
              className="text-xs font-semibold text-indigo-600 hover:text-indigo-800 cursor-pointer"
            >
              {authMode === 'LOGIN'
                ? "Don't have an account? Create one"
                : 'Already have an account? Sign in'}
            </button>
          </div>
        </motion.div>
      </div>
    );
  }

  const activeHabits = habits.filter((h) => !h.isArchived);
  const todayScheduledGoals = activeHabits.filter((h) => h.isScheduledToday !== false);
  const completedTodayCount = todayScheduledGoals.filter((h) => h.completedToday).length;
  const pendingGoals = todayScheduledGoals.filter((h) => !h.completedToday);

  const todayCompletionPct =
    analytics?.todayCompletionPercentage ??
    (todayScheduledGoals.length > 0
      ? Math.round((completedTodayCount / todayScheduledGoals.length) * 100)
      : 0);
  const weeklyAvgPct = analytics?.weeklyCompletionPercentage ?? 0;
  const thirtyDayPct = analytics?.thirtyDayCompletionPercentage ?? 0;
  const bestStreak =
    analytics?.currentStreak ??
    activeHabits.reduce((max, h) => Math.max(max, h.currentStreak), 0);
  const longestStreak =
    analytics?.longestStreak ??
    habits.reduce((max, h) => Math.max(max, h.longestStreak || h.currentStreak), 0);
  const totalVerifiedCompletions =
    analytics?.totalCompletedScheduledHabits ??
    habits.reduce((sum, h) => sum + h.weeklyProgress.filter((d) => d.completed).length, 0);

  const trend7Days = analytics?.trend7Days || [];
  const recent14Days = (analytics?.trend30Days || []).slice(-14);

  const filteredHabits = habits
    .filter((h) => (showArchived ? true : !h.isArchived))
    .filter((h) => {
      if (activeFilter === 'LEETCODE') return h.verificationType === 'LEETCODE';
      if (activeFilter !== 'ALL') return h.category === activeFilter;
      return true;
    })
    .filter((h) => h.title.toLowerCase().includes(searchQuery.toLowerCase()))
    .sort((a, b) => {
      const aPin = pinnedIds.includes(a.id) ? -1 : 0;
      const bPin = pinnedIds.includes(b.id) ? -1 : 0;
      return aPin - bPin;
    });

  const totalScheduledToday = Math.max(todayScheduledGoals.length, 1);
  const completedBarWidth =
    todayScheduledGoals.length > 0
      ? Math.round((completedTodayCount / totalScheduledToday) * 100)
      : 0;

  const userFirstName = currentUser.name.split(' ')[0] || 'there';
  const userInitials = currentUser.name
    .split(' ')
    .map((p) => p[0])
    .join('')
    .slice(0, 2)
    .toUpperCase();

  const sidebarItems = [
    {
      id: 'DASHBOARD_ALL',
      label: 'Dashboard',
      icon: LayoutGrid,
      isActive: activePage === 'DASHBOARD' && activeFilter === 'ALL',
      onClick: () => {
        setActivePage('DASHBOARD');
        setActiveFilter('ALL');
      },
    },
    {
      id: 'PAGE_PERFORMANCE',
      label: 'Performance Hub',
      icon: Trophy,
      isActive: activePage === 'PERFORMANCE',
      onClick: () => setActivePage('PERFORMANCE'),
    },
    {
      id: 'PAGE_CALENDAR',
      label: 'Calendar',
      icon: Calendar,
      isActive: activePage === 'CALENDAR',
      onClick: () => setActivePage('CALENDAR'),
    },
    {
      id: 'PAGE_STATISTICS',
      label: 'Analytics',
      icon: BarChart3,
      isActive: activePage === 'STATISTICS',
      onClick: () => setActivePage('STATISTICS'),
    },
    {
      id: 'PAGE_SECURITY',
      label: 'Security Labs',
      icon: Shield,
      isActive: activePage === 'SECURITY',
      onClick: () => setActivePage('SECURITY'),
    },
  ];

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col lg:flex-row selection:bg-indigo-600 selection:text-white">
      {/* LEFT SIDEBAR (Desktop) */}
      <aside
        aria-label="Primary Sidebar Navigation"
        className="hidden lg:flex w-[252px] bg-white border-r border-slate-200/90 flex-col justify-between py-6 px-4 shrink-0 fixed top-0 bottom-0 left-0 z-40"
      >
        <div>
          <div className="flex items-center justify-between px-3 mb-7">
            <div className="flex items-center gap-2.5">
              <div className="w-7 h-7 rounded-lg bg-indigo-600 flex items-center justify-center text-white font-bold text-xs shadow-2xs">
                D
              </div>
              <span className="text-base font-extrabold tracking-tight text-slate-900">
                DevTrack
              </span>
            </div>
            <span className="text-[10px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
              v2.0
            </span>
          </div>

          <div className="mb-6">
            <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Workspace
            </p>
            <nav className="space-y-1" aria-label="Main Views">
              {sidebarItems.map((item) => {
                const Icon = item.icon;
                return (
                  <button
                    key={item.id}
                    type="button"
                    onClick={item.onClick}
                    aria-current={item.isActive ? 'page' : undefined}
                    className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-semibold transition cursor-pointer ${
                      item.isActive
                        ? 'bg-indigo-50/90 text-indigo-700'
                        : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                    }`}
                  >
                    <Icon
                      className={`w-4 h-4 ${
                        item.isActive ? 'text-indigo-600' : 'text-slate-400'
                      }`}
                    />
                    <span>{item.label}</span>
                  </button>
                );
              })}
            </nav>
          </div>

          <div>
            <p className="px-3 text-[11px] font-semibold text-slate-400 uppercase tracking-wider mb-1.5">
              Quick Filters
            </p>
            <div className="space-y-1">
              <button
                type="button"
                onClick={() => {
                  setActivePage('DASHBOARD');
                  setActiveFilter('DSA');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition cursor-pointer ${
                  activePage === 'DASHBOARD' && activeFilter === 'DSA'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <Code2 className="w-4 h-4 text-indigo-500" />
                <span>DSA & Algorithms</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setActivePage('DASHBOARD');
                  setActiveFilter('LEETCODE');
                }}
                className={`w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium transition cursor-pointer ${
                  activePage === 'DASHBOARD' && activeFilter === 'LEETCODE'
                    ? 'bg-slate-100 text-slate-900 font-semibold'
                    : 'text-slate-600 hover:text-slate-900 hover:bg-slate-50'
                }`}
              >
                <span className="w-2 h-2 rounded-full bg-amber-500 ml-1 mr-1" />
                <span>LeetCode Auto-Sync</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  openCreateModal();
                  setVerificationType('MANUAL_PROOF');
                  setNewCategory('Full-Stack');
                }}
                className="w-full flex items-center gap-3 px-3 py-2 rounded-xl text-[13px] font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
              >
                <span className="w-2 h-2 rounded-full bg-violet-500 ml-1 mr-1" />
                <span>New Proof Habit</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Status & Account Controls */}
        <div className="space-y-2 pt-4 border-t border-slate-200/80">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-slate-50 border border-slate-200/70">
            <span
              className={`w-2 h-2 rounded-full ${
                isDbOnline ? 'bg-emerald-500' : 'bg-rose-500'
              }`}
            />
            <span className="text-xs font-medium text-slate-600">
              {loading ? 'Syncing workspace...' : isDbOnline ? 'Database connected' : 'Offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleEnableBrowserNotifications}
            className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer"
          >
            <Settings className="w-4 h-4 text-slate-400" />
            <span>Enable Reminders</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <main className="flex-1 lg:ml-[252px] px-4 sm:px-6 lg:px-10 py-6 lg:py-8 pb-24 lg:pb-12 max-w-[1400px] w-full mx-auto">
        {/* TOP HEADER BAR */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-7 pb-5 border-b border-slate-200/80">
          <div>
            <h1 className="text-xl sm:text-2xl font-extrabold tracking-tight text-slate-900">
              {activePage === 'PERFORMANCE'
                ? 'Performance Hub'
                : activePage === 'CALENDAR'
                ? 'Habit Calendar'
                : activePage === 'STATISTICS'
                ? 'Progress Analytics'
                : activePage === 'SECURITY'
                ? 'Security Practice Labs'
                : `Welcome back, ${userFirstName}`}
            </h1>
            <p className="text-xs sm:text-sm text-slate-500 mt-0.5">
              {todayStr} {"\u2022"} Small, consistent steps compound into lasting mastery.
            </p>
          </div>

          <div className="flex items-center gap-2.5 sm:gap-3">
            <AnimatePresence>
              {showSearch && (
                <motion.input
                  initial={prefersReducedMotion ? false : { width: 0, opacity: 0 }}
                  animate={{ width: 190, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  type="text"
                  aria-label="Search habits"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Search habits..."
                  className="bg-white border border-slate-200 rounded-xl px-3 py-1.5 text-xs text-slate-900 shadow-2xs"
                />
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={openCreateModal}
              className="bg-indigo-600 hover:bg-indigo-700 text-white font-semibold text-xs sm:text-[13px] px-4 py-2 rounded-xl shadow-xs flex items-center gap-1.5 transition cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>New Habit</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSearch((p) => !p)}
              aria-label="Toggle habit search"
              aria-expanded={showSearch}
              className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer shadow-2xs"
            >
              <Search className="w-4 h-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((p) => !p)}
                aria-label={`Scheduled habits remaining today (${pendingGoals.length})`}
                aria-expanded={showNotifications}
                className="w-9 h-9 rounded-xl bg-white border border-slate-200/90 flex items-center justify-center text-slate-600 hover:text-slate-900 hover:bg-slate-50 transition cursor-pointer relative shadow-2xs"
              >
                <Bell className="w-4 h-4" />
                {pendingGoals.length > 0 && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-indigo-600 ring-2 ring-white" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={prefersReducedMotion ? false : { opacity: 0, y: 6, scale: 0.98 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 6, scale: 0.98 }}
                    className="absolute right-0 mt-2 w-80 bg-white border border-slate-200 rounded-2xl p-4 shadow-lg z-50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-slate-900">
                        Remaining Today ({pendingGoals.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleEnableBrowserNotifications}
                        className="text-[11px] font-semibold text-indigo-600 hover:underline cursor-pointer"
                      >
                        Enable Reminders
                      </button>
                    </div>
                    {pendingGoals.length === 0 ? (
                      <p className="text-xs text-emerald-700 bg-emerald-50 p-2.5 rounded-xl border border-emerald-200">
                        All scheduled habits for today are complete. Great work!
                      </p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {pendingGoals.map((g) => (
                          <div
                            key={g.id}
                            className="p-2.5 rounded-xl bg-slate-50 border border-slate-200/70 text-xs"
                          >
                            <div className="font-semibold text-slate-900">{g.title}</div>
                            <div className="text-slate-500 text-[11px] mt-0.5">
                              {g.verificationType === 'LEETCODE'
                                ? `Solve ${g.dailyTargetCount} on LeetCode (@${g.leetcodeUsername}) and click Sync`
                                : 'Add a short note when you complete this habit today'}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            <div
              title={`${currentUser.name} (${currentUser.email})`}
              className="w-9 h-9 rounded-xl bg-indigo-50 border border-indigo-200 flex items-center justify-center text-xs font-bold text-indigo-700"
            >
              {userInitials || 'U'}
            </div>
          </div>
        </header>

        {/* Feedback Banners */}
        <AnimatePresence>
          {error && (
            <motion.div
              role="alert"
              initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-6 flex flex-wrap items-center justify-between gap-3 px-4 py-3 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
                <span>{error}</span>
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setReloadCounter((c) => c + 1)}
                  className="px-2.5 py-1 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-xs font-semibold text-rose-700 flex items-center gap-1 cursor-pointer"
                >
                  <RefreshCw className="w-3 h-3" /> Retry
                </button>
                <button
                  type="button"
                  aria-label="Dismiss error"
                  onClick={() => setError(null)}
                  className="text-rose-500 hover:text-rose-800 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              role="status"
              initial={prefersReducedMotion ? false : { opacity: 0, y: -4 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -4 }}
              className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-xl bg-emerald-50 border border-emerald-200 text-emerald-900 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-600 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                type="button"
                aria-label="Dismiss message"
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-600 hover:text-emerald-900 cursor-pointer"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PAGE ROUTER */}
        {activePage === 'PERFORMANCE' ? (
          <PerformanceHubView todayStr={todayStr} />
        ) : activePage === 'CALENDAR' ? (
          <HabitCalendarView habits={habits} todayStr={todayStr} />
        ) : activePage === 'STATISTICS' ? (
          <StatisticsView habits={habits} analytics={analytics} todayStr={todayStr} />
        ) : activePage === 'SECURITY' ? (
          <SecurityLabsView
            habits={habits}
            onQuickCreateLab={handleQuickCreateSecurityLab}
            onSubmitLabProof={executeToggle}
            onUncheckLab={(habitId) => executeToggle(habitId, '')}
            onDeleteLab={async (id) => {
              const found = habits.find((h) => h.id === id);
              if (found) setHabitToDelete(found);
            }}
          />
        ) : (
          <>
            {/* TOP 3-COLUMN SUMMARY ROW */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-5 mb-7 tabular-nums">
              {/* CARD 1: Today's Overview & Streaks */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between mb-3">
                  <h2 className="text-sm font-bold text-slate-900">Today's Consistency</h2>
                  <span className="text-xs font-semibold px-2.5 py-0.5 rounded-full bg-indigo-50 text-indigo-700 border border-indigo-200/60">
                    {todayCompletionPct}% complete
                  </span>
                </div>

                <div className="flex items-baseline gap-6 my-2">
                  <div>
                    <div className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>{bestStreak}d</span>
                      <Flame className="w-5 h-5 text-amber-500 shrink-0" />
                    </div>
                    <span className="text-xs text-slate-500">Current streak</span>
                  </div>
                  <div className="h-8 w-[1px] bg-slate-200" />
                  <div>
                    <div className="text-3xl font-extrabold text-slate-900 tracking-tight flex items-center gap-1.5">
                      <span>{longestStreak}d</span>
                      <Trophy className="w-5 h-5 text-indigo-600 shrink-0" />
                    </div>
                    <span className="text-xs text-slate-500">Longest streak</span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden my-4">
                  <div
                    style={{ width: `${completedBarWidth}%` }}
                    className="bg-emerald-500 h-full transition-all duration-500 rounded-full"
                  />
                </div>

                <div className="grid grid-cols-3 gap-2.5">
                  <div className="bg-slate-50 border border-slate-200/70 rounded-xl p-3 text-center">
                    <div className="text-xl font-extrabold text-slate-900 leading-none">
                      {todayScheduledGoals.length}
                    </div>
                    <div className="text-[11px] font-medium text-slate-500 mt-1">Scheduled</div>
                  </div>

                  <div className="bg-amber-50/60 border border-amber-200/70 rounded-xl p-3 text-center">
                    <div className="text-xl font-extrabold text-amber-800 leading-none">
                      {pendingGoals.length}
                    </div>
                    <div className="text-[11px] font-medium text-amber-700 mt-1">Remaining</div>
                  </div>

                  <div className="bg-emerald-50/70 border border-emerald-200/80 rounded-xl p-3 text-center">
                    <div className="text-xl font-extrabold text-emerald-800 leading-none">
                      {completedTodayCount}
                    </div>
                    <div className="text-[11px] font-medium text-emerald-700 mt-1">Completed</div>
                  </div>
                </div>
              </div>

              {/* CARD 2: 7-Day Scheduled Completion Bars */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
                <div className="flex items-center justify-between mb-2">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">7-Day Completion Rate</h2>
                    <p className="text-xs text-slate-500">Scheduled daily check-ins</p>
                  </div>
                  <span className="bg-emerald-50 text-emerald-700 border border-emerald-200 text-xs font-bold px-2.5 py-0.5 rounded-full">
                    {weeklyAvgPct}% wk
                  </span>
                </div>

                <div className="grid grid-cols-7 gap-3 items-end h-[128px] pt-3 px-2">
                  {(trend7Days.length > 0
                    ? trend7Days
                    : Array.from({ length: 7 }, (_, i) => ({
                        date: `day-${i}`,
                        scheduledCount: 0,
                        completedCount: 0,
                        completionPercentage: 0,
                      }))
                  ).map((st, idx) => {
                    const isToday = idx === 6;
                    const dayLetter = st.date.startsWith('day-')
                      ? ['M', 'T', 'W', 'T', 'F', 'S', 'S'][idx]
                      : new Date(`${st.date}T00:00:00Z`).toLocaleDateString('en-US', {
                          weekday: 'narrow',
                          timeZone: 'UTC',
                        });
                    return (
                      <div
                        key={st.date}
                        title={`${st.date}: ${st.completedCount}/${st.scheduledCount} (${st.completionPercentage}%)`}
                        className="flex flex-col items-center gap-2 h-full justify-end"
                      >
                        <div className="w-2.5 h-[92px] rounded-full bg-slate-100 flex items-end overflow-hidden">
                          <div
                            style={{
                              height: `${
                                st.scheduledCount === 0
                                  ? 8
                                  : Math.max(st.completionPercentage, 12)
                              }%`,
                            }}
                            className={`w-full rounded-full transition-all duration-500 ${
                              st.completionPercentage === 100 && st.scheduledCount > 0
                                ? 'bg-emerald-500'
                                : st.completionPercentage > 0
                                ? 'bg-indigo-500'
                                : 'bg-slate-200'
                            }`}
                          />
                        </div>
                        <span
                          className={`text-[11px] font-semibold ${
                            isToday ? 'text-indigo-600 font-bold' : 'text-slate-500'
                          }`}
                        >
                          {dayLetter}
                        </span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span>All-time check-ins: {totalVerifiedCompletions}</span>
                  <button
                    type="button"
                    onClick={() => setActivePage('STATISTICS')}
                    className="text-indigo-600 hover:text-indigo-800 font-semibold flex items-center gap-1 cursor-pointer"
                  >
                    <span>30d rate ({thirtyDayPct}%)</span>
                    <ArrowRight className="w-3.5 h-3.5" />
                  </button>
                </div>
              </div>

              {/* CARD 3: 14-Day Activity Strip & Calendar Shortcut */}
              <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xs md:col-span-2 xl:col-span-1">
                <div className="flex items-center justify-between">
                  <div>
                    <h2 className="text-sm font-bold text-slate-900">Recent 14-Day History</h2>
                    <p className="text-xs text-slate-500 mt-0.5">
                      Daily completion snapshot
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={() => setActivePage('CALENDAR')}
                    className="text-xs font-semibold px-3 py-1.5 rounded-xl bg-slate-100 text-slate-700 hover:bg-indigo-50 hover:text-indigo-700 transition cursor-pointer"
                  >
                    Open Calendar
                  </button>
                </div>

                <div className="grid grid-cols-7 gap-2 my-4">
                  {(recent14Days.length > 0
                    ? recent14Days
                    : Array.from({ length: 14 }, (_, i) => ({
                        date: `empty-${i}`,
                        scheduledCount: 0,
                        completedCount: 0,
                        completionPercentage: 0,
                      }))
                  ).map((pt) => {
                    const dayNum = pt.date.startsWith('empty-') ? '-' : pt.date.slice(8);
                    return (
                      <div
                        key={pt.date}
                        title={
                          pt.date.startsWith('empty-')
                            ? 'No data'
                            : `${pt.date}: ${pt.completedCount}/${pt.scheduledCount} completed (${pt.completionPercentage}%)`
                        }
                        className={`h-10 rounded-xl flex flex-col items-center justify-center text-xs font-semibold border ${
                          pt.completionPercentage === 100 && pt.scheduledCount > 0
                            ? 'bg-emerald-50 border-emerald-300 text-emerald-800'
                            : pt.completionPercentage > 0
                            ? 'bg-indigo-50 border-indigo-200 text-indigo-800'
                            : 'bg-slate-50 border-slate-200/70 text-slate-400'
                        }`}
                      >
                        <span>{dayNum}</span>
                      </div>
                    );
                  })}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-slate-100 text-xs text-slate-500">
                  <span className="flex items-center gap-1.5">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Same-day check-in protection</span>
                  </span>
                  <button
                    type="button"
                    onClick={() => setActivePage('PERFORMANCE')}
                    className="text-indigo-600 hover:underline font-semibold cursor-pointer"
                  >
                    Performance Hub
                  </button>
                </div>
              </div>
            </section>

            {/* MIDDLE ROW: Today's Checklist + Habit Cards */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
              <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <div>
                      <h2 className="text-base font-bold text-slate-900">Today's Checklist</h2>
                      <p className="text-xs text-slate-500">Habits scheduled for today</p>
                    </div>
                    <span className="text-xs font-bold px-2.5 py-1 rounded-full bg-slate-100 text-slate-700 tabular-nums">
                      {completedTodayCount}/{todayScheduledGoals.length}
                    </span>
                  </div>

                  {loading ? (
                    <div className="space-y-2.5 py-2" aria-busy="true">
                      {[1, 2, 3].map((n) => (
                        <div
                          key={n}
                          className="h-11 rounded-xl bg-slate-100 animate-pulse"
                        />
                      ))}
                    </div>
                  ) : todayScheduledGoals.length === 0 ? (
                    <div className="py-8 px-3 text-center bg-slate-50 rounded-xl border border-slate-200/60 mb-5">
                      <p className="text-xs font-semibold text-slate-700">
                        {activeHabits.length === 0
                          ? 'Start with one small daily habit'
                          : 'No habits scheduled for today'}
                      </p>
                      <p className="text-xs text-slate-500 mt-1">
                        {activeHabits.length === 0
                          ? 'Pick a quick-start template below or click New Habit to begin.'
                          : 'Enjoy your planned rest day. Your streaks remain intact.'}
                      </p>
                    </div>
                  ) : (
                    <div className="space-y-2 mb-6">
                      {todayScheduledGoals.map((h) => (
                        <div
                          key={h.id}
                          onClick={() =>
                            h.verificationType === 'LEETCODE'
                              ? handleVerifyLeetCode(h.id)
                              : handleToggleManual(h.id)
                          }
                          className="flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/70 hover:border-indigo-300 hover:bg-slate-50/70 transition cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                                h.completedToday
                                  ? 'bg-emerald-600 text-white'
                                  : 'border border-slate-300 bg-white group-hover:border-indigo-500'
                              }`}
                            >
                              {h.completedToday && <Check className="w-3.5 h-3.5 stroke-[2.5]" />}
                            </div>
                            <span
                              className={`text-xs sm:text-[13px] font-semibold ${
                                h.completedToday
                                  ? 'text-slate-400 line-through'
                                  : 'text-slate-800'
                              }`}
                            >
                              {h.title}
                            </span>
                          </div>
                          <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-slate-100 text-slate-600">
                            {h.verificationType === 'LEETCODE' ? 'LeetCode' : 'Note'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-slate-100">
                  <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    Quick-Start Templates
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_GOALS.slice(0, 3).map((preset) => (
                      <button
                        key={preset.title}
                        type="button"
                        onClick={() => {
                          openCreateModal();
                          setNewTitle(preset.title);
                          setNewCategory(preset.category);
                          setVerificationType(preset.verificationType);
                          setDailyTargetCount(preset.dailyTargetCount);
                        }}
                        className="text-xs font-medium px-3 py-1.5 rounded-xl bg-slate-50 hover:bg-indigo-50 text-slate-700 hover:text-indigo-700 border border-slate-200/80 transition cursor-pointer"
                      >
                        + {preset.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT 8 COLS: Active & Archived Habit Cards */}
              <div className="xl:col-span-8 flex flex-col justify-between">
                <div className="flex flex-wrap items-center justify-between gap-2 mb-4 px-1">
                  <div className="flex items-center gap-3">
                    <h2 className="text-base font-bold text-slate-900">
                      Your Habits ({filteredHabits.length})
                    </h2>
                    <button
                      type="button"
                      onClick={() => setShowArchived((s) => !s)}
                      className={`text-xs font-semibold px-3 py-1 rounded-lg border transition cursor-pointer ${
                        showArchived
                          ? 'bg-indigo-50 border-indigo-200 text-indigo-700'
                          : 'bg-white border-slate-200 text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {showArchived ? 'Showing Archived' : 'Show Archived'}
                    </button>
                  </div>
                  <span className="flex items-center gap-1.5 text-xs text-slate-500">
                    <Lock className="w-3.5 h-3.5 text-slate-400" />
                    <span>Same-day check-in verification</span>
                  </span>
                </div>

                {loading ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                    {[1, 2, 3].map((n) => (
                      <div
                        key={n}
                        className="rounded-2xl h-[230px] bg-white border border-slate-200/80 animate-pulse p-5"
                      />
                    ))}
                  </div>
                ) : (
                  <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4 flex-1">
                    {filteredHabits.map((habit) => {
                      const isVerifying = verifyingId === habit.id;
                      const isProofOpen = proofInputHabitId === habit.id;
                      const isPinned = pinnedIds.includes(habit.id);
                      const scheduleText =
                        !habit.scheduledDays || habit.scheduledDays.length === 7
                          ? 'Daily'
                          : habit.scheduledDays.map((d) => WEEKDAY_NAMES[d]).join(', ');

                      return (
                        <div
                          key={habit.id}
                          className={`relative rounded-2xl p-5 flex flex-col justify-between min-h-[230px] transition shadow-xs ${
                            habit.isArchived
                              ? 'bg-slate-50 border border-dashed border-slate-300 opacity-80'
                              : habit.completedToday
                              ? 'bg-white border border-emerald-300'
                              : 'bg-white border border-slate-200/90 hover:border-slate-300'
                          }`}
                        >
                          <div>
                            <div className="flex items-center justify-between mb-3.5">
                              <div className="flex items-center gap-2.5">
                                <div className="w-10 h-10 rounded-xl bg-slate-50 border border-slate-200/70 flex items-center justify-center shrink-0">
                                  {getCategoryIcon(habit.category)}
                                </div>
                                <div>
                                  <span className="text-[10.5px] font-semibold uppercase tracking-wider text-slate-500 block">
                                    {habit.category} {"\u2022"} {scheduleText}
                                  </span>
                                  <span className="text-xs font-bold text-slate-800 flex items-center gap-1 mt-0.5 tabular-nums">
                                    <Flame className="w-3.5 h-3.5 text-amber-500 shrink-0" />
                                    <span>
                                      {habit.currentStreak}d (Best:{' '}
                                      {habit.longestStreak ?? habit.currentStreak}d)
                                      {isPinned ? ' \u2022 Pinned' : ''}
                                      {habit.isArchived ? ' \u2022 Archived' : ''}
                                    </span>
                                  </span>
                                </div>
                              </div>

                              <div className="relative">
                                <button
                                  type="button"
                                  aria-label={`Options for ${habit.title}`}
                                  aria-expanded={openMenuHabitId === habit.id}
                                  onClick={() =>
                                    setOpenMenuHabitId(
                                      openMenuHabitId === habit.id ? null : habit.id
                                    )
                                  }
                                  className="w-8 h-8 rounded-lg hover:bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                                >
                                  <MoreHorizontal className="w-4 h-4" />
                                </button>

                                <AnimatePresence>
                                  {openMenuHabitId === habit.id && (
                                    <motion.div
                                      initial={
                                        prefersReducedMotion ? false : { opacity: 0, scale: 0.95 }
                                      }
                                      animate={{ opacity: 1, scale: 1 }}
                                      exit={{ opacity: 0, scale: 0.95 }}
                                      className="absolute right-0 top-9 w-40 bg-white border border-slate-200 text-slate-800 rounded-xl p-1.5 shadow-lg z-30 space-y-0.5"
                                    >
                                      <button
                                        type="button"
                                        onClick={() => openEditModal(habit)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
                                      >
                                        <span>Edit habit</span>
                                        <Edit3 className="w-3.5 h-3.5 text-slate-500" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => togglePin(habit.id)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
                                      >
                                        <span>{isPinned ? 'Unpin' : 'Pin to top'}</span>
                                        <Pin className="w-3.5 h-3.5 text-slate-500" />
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => handleArchiveToggle(habit)}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium hover:bg-slate-100 cursor-pointer"
                                      >
                                        <span>{habit.isArchived ? 'Restore' : 'Archive'}</span>
                                        {habit.isArchived ? (
                                          <ArchiveRestore className="w-3.5 h-3.5 text-slate-500" />
                                        ) : (
                                          <Archive className="w-3.5 h-3.5 text-slate-500" />
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        onClick={() => {
                                          setOpenMenuHabitId(null);
                                          setHabitToDelete(habit);
                                        }}
                                        className="w-full flex items-center justify-between px-3 py-1.5 rounded-lg text-xs font-medium text-rose-600 hover:bg-rose-50 cursor-pointer"
                                      >
                                        <span>Delete</span>
                                        <Trash2 className="w-3.5 h-3.5" />
                                      </button>
                                    </motion.div>
                                  )}
                                </AnimatePresence>
                              </div>
                            </div>

                            <h3 className="text-[15px] font-bold text-slate-900 leading-snug mb-1">
                              {habit.title}
                            </h3>

                            {habit.verificationType === 'LEETCODE' ? (
                              <p className="text-xs text-slate-500">
                                LeetCode:{' '}
                                <strong className="text-slate-800">
                                  @{habit.leetcodeUsername}
                                </strong>{' '}
                                ({habit.dailyTargetCount}/day)
                              </p>
                            ) : (
                              <p className="text-xs text-slate-500">
                                {habit.todayNote
                                  ? `Note: "${habit.todayNote}"`
                                  : habit.isScheduledToday === false
                                  ? 'Planned rest day today'
                                  : 'Add a short note on check-in'}
                              </p>
                            )}

                            {isProofOpen && (
                              <div className="mt-3 p-3 rounded-xl bg-slate-50 border border-slate-200">
                                <input
                                  type="text"
                                  aria-label="Enter check-in note"
                                  value={proofNote}
                                  onChange={(e) => setProofNote(e.target.value)}
                                  placeholder="Short summary or commit link..."
                                  className="w-full bg-white border border-slate-200 rounded-lg px-2.5 py-1.5 text-xs text-slate-900 mb-2"
                                  autoFocus
                                />
                                <div className="flex justify-end gap-1.5">
                                  <button
                                    type="button"
                                    onClick={() => setProofInputHabitId(null)}
                                    className="text-xs px-2.5 py-1 rounded-lg text-slate-500 hover:text-slate-800"
                                  >
                                    Cancel
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => executeToggle(habit.id, proofNote)}
                                    className="text-xs font-semibold px-3 py-1 rounded-lg bg-indigo-600 hover:bg-indigo-700 text-white cursor-pointer"
                                  >
                                    Complete
                                  </button>
                                </div>
                              </div>
                            )}
                          </div>

                          {/* Card Footer: 7-Day Strip + Action Button */}
                          <div className="flex flex-wrap items-center justify-between gap-2 mt-5 pt-3 border-t border-slate-100">
                            <div className="flex items-center gap-1">
                              {habit.weeklyProgress.map((day, idx) => {
                                const isToday = idx === habit.weeklyProgress.length - 1;
                                const isScheduled = day.isScheduled !== false;
                                const letter = new Date(
                                  `${day.date}T00:00:00Z`
                                ).toLocaleDateString('en-US', {
                                  weekday: 'narrow',
                                  timeZone: 'UTC',
                                });
                                return (
                                  <div
                                    key={day.date}
                                    title={`${day.date}: ${
                                      day.completed
                                        ? 'Completed'
                                        : !isScheduled
                                        ? 'Rest day'
                                        : isToday
                                        ? 'Scheduled today'
                                        : 'Past date'
                                    }`}
                                    className={`w-5 h-7 rounded-md flex flex-col items-center justify-center text-[9.5px] font-semibold ${
                                      day.completed
                                        ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                        : !isScheduled
                                        ? 'bg-slate-50 text-slate-300'
                                        : isToday
                                        ? 'bg-indigo-50 text-indigo-700 border border-indigo-300'
                                        : 'bg-slate-100 text-slate-400'
                                    }`}
                                  >
                                    <span>{letter}</span>
                                    <span className="text-[7px] leading-none mt-0.5">
                                      {day.completed
                                        ? '\u25CF'
                                        : !isScheduled
                                        ? '-'
                                        : isToday
                                        ? '\u25CE'
                                        : '\u00B7'}
                                    </span>
                                  </div>
                                );
                              })}
                            </div>

                            {habit.isArchived ? (
                              <button
                                type="button"
                                onClick={() => handleArchiveToggle(habit)}
                                className="px-3 py-1.5 rounded-xl bg-slate-100 hover:bg-slate-200 text-xs font-semibold text-slate-700 cursor-pointer shrink-0"
                              >
                                Restore
                              </button>
                            ) : habit.verificationType === 'LEETCODE' ? (
                              <button
                                type="button"
                                disabled={isVerifying || habit.isScheduledToday === false}
                                onClick={() => handleVerifyLeetCode(habit.id)}
                                aria-label={`Sync LeetCode for ${habit.title}`}
                                className={`px-3 py-1.5 rounded-xl text-xs font-semibold flex items-center gap-1.5 transition cursor-pointer shrink-0 ${
                                  habit.completedToday
                                    ? 'bg-emerald-600 text-white'
                                    : habit.isScheduledToday === false
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                              >
                                <RefreshCw
                                  className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`}
                                />
                                <span>
                                  {habit.completedToday
                                    ? 'Done'
                                    : habit.isScheduledToday === false
                                    ? 'Rest'
                                    : 'Sync'}
                                </span>
                              </button>
                            ) : (
                              <button
                                type="button"
                                disabled={habit.isScheduledToday === false && !habit.completedToday}
                                aria-label={
                                  habit.completedToday
                                    ? `Undo today's check-in for ${habit.title}`
                                    : `Complete ${habit.title} for today`
                                }
                                onClick={() => handleToggleManual(habit.id)}
                                className={`w-9 h-9 rounded-xl flex items-center justify-center transition cursor-pointer shrink-0 ${
                                  habit.completedToday
                                    ? 'bg-emerald-600 text-white'
                                    : habit.isScheduledToday === false
                                    ? 'bg-slate-100 text-slate-400 cursor-not-allowed'
                                    : 'bg-indigo-600 hover:bg-indigo-700 text-white'
                                }`}
                              >
                                {habit.completedToday ? (
                                  <Check className="w-4 h-4 stroke-[2.5]" />
                                ) : (
                                  <Plus className="w-4 h-4 stroke-[2.5]" />
                                )}
                              </button>
                            )}
                          </div>
                        </div>
                      );
                    })}

                    <button
                      type="button"
                      onClick={openCreateModal}
                      className="rounded-2xl border-2 border-dashed border-slate-200 hover:border-indigo-300 bg-white/60 hover:bg-white min-h-[230px] flex flex-col items-center justify-center gap-2 text-slate-500 hover:text-indigo-600 font-semibold text-xs transition cursor-pointer group p-5"
                    >
                      <div className="w-10 h-10 rounded-xl bg-slate-100 group-hover:bg-indigo-50 flex items-center justify-center transition">
                        <Plus className="w-5 h-5" />
                      </div>
                      <span>Create a new habit</span>
                    </button>
                  </div>
                )}
              </div>
            </section>
          </>
        )}
      </main>

      {/* CREATE / EDIT HABIT MODAL */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="modal-habit-title"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-lg w-full p-6 sm:p-7 shadow-xl max-h-[92vh] overflow-y-auto"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 id="modal-habit-title" className="text-lg font-bold text-slate-900">
                    {editingHabit ? 'Edit Habit' : 'Create a New Habit'}
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    {editingHabit
                      ? 'Update your habit title, category, or weekly schedule without losing past history.'
                      : 'Choose a starter template or customize your own recurring schedule.'}
                  </p>
                </div>
                <button
                  type="button"
                  aria-label="Close modal"
                  onClick={() => {
                    setShowAddForm(false);
                    setEditingHabit(null);
                  }}
                  className="w-8 h-8 rounded-lg bg-slate-100 flex items-center justify-center text-slate-500 hover:text-slate-900 cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              {!editingHabit && (
                <div className="mb-5">
                  <label className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 block mb-2">
                    Starter Templates
                  </label>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {PRESET_GOALS.map((p) => (
                      <button
                        key={p.title}
                        type="button"
                        onClick={() => {
                          setNewTitle(p.title);
                          setNewCategory(p.category);
                          setVerificationType(p.verificationType);
                          setDailyTargetCount(p.dailyTargetCount);
                        }}
                        className={`text-left p-2.5 rounded-xl border transition cursor-pointer ${
                          newTitle === p.title
                            ? 'bg-indigo-50/80 border-indigo-300 text-indigo-950'
                            : 'bg-slate-50 border-slate-200/80 text-slate-700 hover:border-slate-300'
                        }`}
                      >
                        <div className="text-xs font-bold text-slate-900">{p.title}</div>
                        <div className="text-[11px] text-slate-500 mt-0.5">{p.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>
              )}

              <form onSubmit={handleSaveHabit} className="space-y-4">
                <div>
                  <label
                    htmlFor="habit-title-input"
                    className="text-xs font-semibold text-slate-700 block mb-1.5"
                  >
                    Habit Name
                  </label>
                  <input
                    id="habit-title-input"
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Solve 2 LeetCode Mediums"
                    required
                    className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3.5 py-2.5 text-sm text-slate-900"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label
                      htmlFor="habit-category-select"
                      className="text-xs font-semibold text-slate-700 block mb-1.5"
                    >
                      Category
                    </label>
                    <select
                      id="habit-category-select"
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900"
                    >
                      <option value="DSA">DSA & Algorithms</option>
                      <option value="Full-Stack">Full-Stack Dev</option>
                      <option value="System Design">System Design</option>
                      <option value="Cybersecurity">Cybersecurity</option>
                    </select>
                  </div>

                  <div>
                    <label
                      htmlFor="habit-verification-select"
                      className="text-xs font-semibold text-slate-700 block mb-1.5"
                    >
                      Check-in Method
                    </label>
                    <select
                      id="habit-verification-select"
                      disabled={Boolean(editingHabit)}
                      value={verificationType}
                      onChange={(e) =>
                        setVerificationType(e.target.value as 'MANUAL_PROOF' | 'LEETCODE')
                      }
                      className="w-full bg-slate-50 border border-slate-200 rounded-xl px-3 py-2.5 text-sm text-slate-900 disabled:opacity-60"
                    >
                      <option value="LEETCODE">LeetCode Auto-Sync</option>
                      <option value="MANUAL_PROOF">Summary Note</option>
                    </select>
                  </div>
                </div>

                {verificationType === 'LEETCODE' && (
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-xl bg-indigo-50/50 border border-indigo-200/80">
                    <div className="col-span-2">
                      <label
                        htmlFor="lc-username-input"
                        className="text-xs font-semibold text-slate-700 block mb-1"
                      >
                        LeetCode Username
                      </label>
                      <input
                        id="lc-username-input"
                        type="text"
                        value={leetcodeUsername}
                        onChange={(e) => setLeetcodeUsername(e.target.value)}
                        placeholder="divypatel31"
                        required
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                    <div>
                      <label
                        htmlFor="lc-target-input"
                        className="text-xs font-semibold text-slate-700 block mb-1"
                      >
                        Daily Target
                      </label>
                      <input
                        id="lc-target-input"
                        type="number"
                        min={1}
                        max={15}
                        value={dailyTargetCount}
                        onChange={(e) => setDailyTargetCount(Number(e.target.value))}
                        className="w-full bg-white border border-slate-200 rounded-xl px-3 py-2 text-xs text-slate-900"
                      />
                    </div>
                  </div>
                )}

                <div>
                  <div className="flex items-center justify-between mb-1.5">
                    <label className="text-xs font-semibold text-slate-700">
                      Weekly Schedule (
                      {scheduledDays.length === 7 ? 'Every day' : `${scheduledDays.length} days/wk`}
                      )
                    </label>
                    <button
                      type="button"
                      onClick={() => setScheduledDays([0, 1, 2, 3, 4, 5, 6])}
                      className="text-xs font-semibold text-indigo-600 hover:underline cursor-pointer"
                    >
                      Select All
                    </button>
                  </div>
                  <div className="grid grid-cols-7 gap-1.5">
                    {WEEKDAY_NAMES.map((dayLabel, idx) => {
                      const isSelected = scheduledDays.includes(idx);
                      return (
                        <button
                          key={dayLabel}
                          type="button"
                          aria-pressed={isSelected}
                          onClick={() =>
                            setScheduledDays((prev) =>
                              prev.includes(idx)
                                ? prev.length > 1
                                  ? prev.filter((d) => d !== idx)
                                  : prev
                                : [...prev, idx].sort((a, b) => a - b)
                            )
                          }
                          className={`py-2 rounded-xl text-xs font-semibold border transition cursor-pointer ${
                            isSelected
                              ? 'bg-indigo-600 border-indigo-600 text-white shadow-2xs'
                              : 'bg-slate-50 border-slate-200 text-slate-600 hover:text-slate-900'
                          }`}
                        >
                          {dayLabel}
                        </button>
                      );
                    })}
                  </div>
                </div>

                <div className="flex justify-end gap-2.5 pt-3 border-t border-slate-100">
                  <button
                    type="button"
                    onClick={() => {
                      setShowAddForm(false);
                      setEditingHabit(null);
                    }}
                    className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-indigo-600 hover:bg-indigo-700 text-white text-xs font-semibold px-5 py-2 rounded-xl shadow-xs cursor-pointer"
                  >
                    {submitting
                      ? 'Saving...'
                      : editingHabit
                      ? 'Save Changes'
                      : 'Create Habit'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* DESTRUCTIVE DELETE CONFIRMATION MODAL */}
      <AnimatePresence>
        {habitToDelete && (
          <motion.div
            role="dialog"
            aria-modal="true"
            aria-labelledby="delete-modal-title"
            initial={prefersReducedMotion ? false : { opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-slate-900/40 backdrop-blur-xs z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={prefersReducedMotion ? false : { scale: 0.96, y: 8 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.96, y: 8 }}
              className="bg-white border border-slate-200 rounded-2xl max-w-md w-full p-6 shadow-xl"
            >
              <div className="flex items-center gap-3 mb-3">
                <div className="w-10 h-10 rounded-xl bg-rose-50 border border-rose-200 flex items-center justify-center text-rose-600">
                  <Trash2 className="w-5 h-5" />
                </div>
                <h2 id="delete-modal-title" className="text-base font-bold text-slate-900">
                  Delete Habit Permanently?
                </h2>
              </div>
              <p className="text-xs text-slate-600 leading-relaxed mb-5">
                Are you sure you want to delete{' '}
                <strong className="text-slate-900">"{habitToDelete.title}"</strong> and its check-in
                history? If you want to hide this habit while keeping your past records, choose{' '}
                <strong className="text-slate-900">Archive Instead</strong>.
              </p>
              <div className="flex flex-wrap justify-end gap-2">
                <button
                  type="button"
                  onClick={() => setHabitToDelete(null)}
                  className="px-4 py-2 rounded-xl text-xs font-semibold text-slate-600 hover:text-slate-900 cursor-pointer"
                >
                  Cancel
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const target = habitToDelete;
                    setHabitToDelete(null);
                    void handleArchiveToggle(target);
                  }}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-slate-100 text-slate-800 hover:bg-slate-200 cursor-pointer"
                >
                  Archive Instead
                </button>
                <button
                  type="button"
                  disabled={deleting}
                  onClick={confirmAndDeleteHabit}
                  className="px-4 py-2 rounded-xl text-xs font-semibold bg-rose-600 hover:bg-rose-700 text-white cursor-pointer"
                >
                  {deleting ? 'Deleting...' : 'Delete Permanently'}
                </button>
              </div>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav
        aria-label="Mobile Navigation"
        className="lg:hidden fixed bottom-0 left-0 right-0 bg-white/95 backdrop-blur-md border-t border-slate-200 px-3 py-2 flex items-center justify-around z-40"
      >
        <button
          type="button"
          onClick={() => {
            setActivePage('DASHBOARD');
            setActiveFilter('ALL');
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
            activePage === 'DASHBOARD' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Home</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePage('PERFORMANCE')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
            activePage === 'PERFORMANCE' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Trophy className="w-4 h-4" />
          <span>Hub</span>
        </button>
        <button
          type="button"
          aria-label="Create new habit"
          onClick={openCreateModal}
          className="w-10 h-10 rounded-xl bg-indigo-600 flex items-center justify-center text-white shadow-sm"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActivePage('CALENDAR')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
            activePage === 'CALENDAR' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>Calendar</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePage('STATISTICS')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold py-1 px-2 rounded-lg ${
            activePage === 'STATISTICS' ? 'text-indigo-600' : 'text-slate-500'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Stats</span>
        </button>
      </nav>
    </div>
  );
}

export default App;