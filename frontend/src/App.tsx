import { useEffect, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  LayoutGrid,
  Calendar,
  CheckSquare,
  BarChart3,
  Shield,
  Settings,
  Bell,
  Search,
  Plus,
  Share2,
  MoreVertical,
  MoreHorizontal,
  Download,
  Flame,
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
  ChevronRight,
  X,
  AlertCircle,
  CheckCircle2,
  LogOut,
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
  fetchHabits,
  createHabit,
  toggleHabitDate,
  verifyLeetCodeHabit,
  deleteHabit,
} from './api/habits';
import type { Habit, DailyProgress } from './types/habit';
import { StatisticsView } from './components/StatisticsView';
import { SecurityLabsView } from './components/SecurityLabsView';

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
    desc: 'Auto-verified via LeetCode GraphQL API',
  },
  {
    title: 'Solve 2 LeetCode Problems',
    category: 'DSA',
    verificationType: 'LEETCODE' as const,
    dailyTargetCount: 2,
    desc: 'Daily medium/hard consistency target',
  },
  {
    title: 'Push 1 GitHub Commit',
    category: 'Full-Stack',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
    desc: 'Requires commit hash or PR proof note',
  },
  {
    title: 'Read System Design (30m)',
    category: 'System Design',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
    desc: 'Log architecture topic or summary note',
  },
  {
    title: 'Complete 1 TryHackMe Room',
    category: 'Cybersecurity',
    verificationType: 'MANUAL_PROOF' as const,
    dailyTargetCount: 1,
    desc: 'Log CTF flag or security lab summary',
  },
];

function getCategoryIcon(category: string) {
  switch (category) {
    case 'DSA':
      return <Code2 className="w-5 h-5 text-[#7c5cfc]" />;
    case 'Full-Stack':
      return <Terminal className="w-5 h-5 text-[#ff4d94]" />;
    case 'System Design':
      return <Cpu className="w-5 h-5 text-[#f5b014]" />;
    case 'Cybersecurity':
      return <Shield className="w-5 h-5 text-[#10b981]" />;
    default:
      return <Sparkles className="w-5 h-5 text-[#7c5cfc]" />;
  }
}

export function App() {
  const [currentUser, setCurrentUser] = useState<AuthUser | null>(() => getStoredUser());
  const [authToken, setAuthToken] = useState<string | null>(() => getStoredToken());
  const [authMode, setAuthMode] = useState<'LOGIN' | 'REGISTER'>('LOGIN');
  const [authName, setAuthName] = useState<string>('');
  const [authEmail, setAuthEmail] = useState<string>('');
  const [authPassword, setAuthPassword] = useState<string>('');
  const [authSubmitting, setAuthSubmitting] = useState<boolean>(false);

  const [health, setHealth] = useState<HealthResponse | null>(null);
  const [habits, setHabits] = useState<Habit[]>([]);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [successMsg, setSuccessMsg] = useState<string | null>(null);

  // Page view & filter state ('DASHBOARD' | 'STATISTICS' | 'SECURITY')
  const [activePage, setActivePage] = useState<'DASHBOARD' | 'STATISTICS' | 'SECURITY'>('DASHBOARD');
  const [activeFilter, setActiveFilter] = useState<string>('ALL');
  const [searchQuery, setSearchQuery] = useState<string>('');
  const [showSearch, setShowSearch] = useState<boolean>(false);
  const [showNotifications, setShowNotifications] = useState<boolean>(false);
  const [openMenuHabitId, setOpenMenuHabitId] = useState<string | null>(null);
  const [pinnedIds, setPinnedIds] = useState<string[]>([]);

  // Modal State
  const [showAddForm, setShowAddForm] = useState<boolean>(false);
  const [newTitle, setNewTitle] = useState<string>('');
  const [newCategory, setNewCategory] = useState<string>('DSA');
  const [verificationType, setVerificationType] = useState<'MANUAL_PROOF' | 'LEETCODE'>('LEETCODE');
  const [leetcodeUsername, setLeetcodeUsername] = useState<string>('divypatel31');
  const [dailyTargetCount, setDailyTargetCount] = useState<number>(1);
  const [submitting, setSubmitting] = useState<boolean>(false);

  // Proof drawer state
  const [proofInputHabitId, setProofInputHabitId] = useState<string | null>(null);
  const [proofNote, setProofNote] = useState<string>('');
  const [verifyingId, setVerifyingId] = useState<string | null>(null);

  const todayStr = getLocalTodayStr();

  useEffect(() => {
    let isCancelled = false;

    async function syncWorkspace() {
      try {
        const healthData = await fetchBackendHealth();
        if (!isCancelled) {
          setHealth(healthData);
        }

        if (!authToken) {
          if (!isCancelled) {
            setHabits([]);
            setLoading(false);
          }
          return;
        }

        const habitsData = await fetchHabits(todayStr);
        if (!isCancelled) {
          setHabits(habitsData);
          setError(null);
        }
      } catch (err) {
        if (!isCancelled) {
          if (!getStoredToken()) {
            setAuthToken(null);
            setCurrentUser(null);
          }
          setError(err instanceof Error ? err.message : 'Failed to connect to server');
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
  }, [authToken, todayStr]);

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
      setError(err instanceof Error ? err.message : 'Authentication failed');
    } finally {
      setAuthSubmitting(false);
    }
  }

  function handleLogout() {
    clearAuthSession();
    setAuthToken(null);
    setCurrentUser(null);
    setHabits([]);
    setSuccessMsg(null);
    setError(null);
  }

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
      setSuccessMsg('New developer goal added to your board!');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create habit');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleQuickCreateSecurityLab(title: string) {
    setError(null);
    try {
      await createHabit({
        title,
        category: 'Cybersecurity',
        targetDaysPerWeek: 7,
        verificationType: 'MANUAL_PROOF',
        dailyTargetCount: 1,
      });
      const updated = await fetchHabits(todayStr);
      setHabits(updated);
      setSuccessMsg(`Security lab "${title}" deployed to your active goals!`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create security lab');
    }
  }

  async function handleToggleManual(habitId: string) {
    const habit = habits.find((h) => h.id === habitId);
    if (!habit) return;

    if (habit.verificationType === 'LEETCODE') {
      setError('Anti-Cheat Lock: LeetCode goals must be verified via "Sync" button.');
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
      setError('Proof required: Enter a work summary, flag, or commit hash (min 4 characters).');
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
        nextCompletedState ? 'Goal verified with proof for today!' : 'Today’s completion removed.'
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
        setSuccessMsg(res.message);
      } else {
        setError(res.message);
        if ('Notification' in window && Notification.permission === 'granted') {
          new Notification('DevTrack • LeetCode Reminder', { body: res.message });
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
      new Notification('DevTrack Reminders Active', {
        body: `You have ${pendingGoals.length} goals in progress for ${todayStr}.`,
      });
      setSuccessMsg('Desktop/Mobile notifications enabled!');
    }
  }

  async function handleDelete(habitId: string) {
    setOpenMenuHabitId(null);
    try {
      await deleteHabit(habitId);
      setHabits((prev) => prev.filter((h) => h.id !== habitId));
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to delete');
    }
  }

  function togglePin(habitId: string) {
    setOpenMenuHabitId(null);
    setPinnedIds((prev) =>
      prev.includes(habitId) ? prev.filter((id) => id !== habitId) : [habitId, ...prev]
    );
  }

  const isDbOnline = health?.status === 'ok';

  // If unauthenticated, render the DevTrack Auth Gate
  if (!authToken || !currentUser) {
    return (
      <div className="min-h-screen bg-[#0b0b10] text-[#f4f4f6] flex items-center justify-center p-4">
        <motion.div
          initial={{ opacity: 0, y: 12 }}
          animate={{ opacity: 1, y: 0 }}
          className="bg-[#151621] border border-white/10 rounded-[28px] max-w-md w-full p-7 shadow-2xl"
        >
          <div className="flex items-center justify-between mb-6">
            <div className="flex items-center gap-3">
              <div className="w-8 h-8 rounded-full border-[3px] border-[#7c5cfc] flex items-center justify-center shadow-[0_0_15px_rgba(124,92,252,0.5)]">
                <div className="w-2.5 h-2.5 rounded-full bg-[#ff4d94]" />
              </div>
              <span className="text-xl font-extrabold tracking-tight text-white">DevTrack</span>
            </div>
            <span
              className={`text-[11px] font-semibold px-2.5 py-1 rounded-full ${
                isDbOnline
                  ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30'
                  : 'bg-rose-500/15 text-rose-400'
              }`}
            >
              ● {isDbOnline ? 'Neon DB Online' : 'Connecting...'}
            </span>
          </div>

          <h1 className="text-2xl font-extrabold text-white mb-1">
            {authMode === 'LOGIN' ? 'Welcome back' : 'Create your developer account'}
          </h1>
          <p className="text-xs text-[#7c7f93] mb-6">
            {authMode === 'LOGIN'
              ? 'Sign in to access your isolated habits, streaks & LeetCode verifier.'
              : 'Every habit and streak is cryptographically isolated to your account.'}
          </p>

          {error && (
            <div className="mb-4 p-3 rounded-xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs flex items-center gap-2">
              <AlertCircle className="w-4 h-4 shrink-0 text-rose-400" />
              <span>{error}</span>
            </div>
          )}

          <form onSubmit={handleAuthSubmit} className="space-y-4">
            {authMode === 'REGISTER' && (
              <div>
                <label className="text-xs font-semibold text-[#9ca0b5] block mb-1.5">
                  Full Name
                </label>
                <input
                  type="text"
                  value={authName}
                  onChange={(e) => setAuthName(e.target.value)}
                  placeholder="Divy Patel"
                  required
                  className="w-full bg-[#0e0f17] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#7c5cfc]"
                />
              </div>
            )}

            <div>
              <label className="text-xs font-semibold text-[#9ca0b5] block mb-1.5">
                Email Address
              </label>
              <input
                type="email"
                value={authEmail}
                onChange={(e) => setAuthEmail(e.target.value)}
                placeholder="divy@devtrack.local"
                required
                className="w-full bg-[#0e0f17] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#7c5cfc]"
              />
            </div>

            <div>
              <label className="text-xs font-semibold text-[#9ca0b5] block mb-1.5">
                Password (min 8 characters)
              </label>
              <input
                type="password"
                value={authPassword}
                onChange={(e) => setAuthPassword(e.target.value)}
                placeholder="••••••••"
                required
                minLength={8}
                className="w-full bg-[#0e0f17] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#7c5cfc]"
              />
            </div>

            <button
              type="submit"
              disabled={authSubmitting}
              className="w-full bg-gradient-to-r from-[#6c47ff] to-[#7c5cfc] hover:from-[#5b36ec] hover:to-[#6c47ff] text-white font-bold text-sm py-3 rounded-xl shadow-[0_6px_20px_rgba(108,71,255,0.4)] transition cursor-pointer"
            >
              {authSubmitting
                ? 'Authenticating...'
                : authMode === 'LOGIN'
                ? 'Sign In to DevTrack'
                : 'Create Account'}
            </button>
          </form>

          <div className="mt-5 pt-4 border-t border-white/[0.06] text-center">
            <button
              type="button"
              onClick={() => {
                setAuthMode((m) => (m === 'LOGIN' ? 'REGISTER' : 'LOGIN'));
                setError(null);
              }}
              className="text-xs font-semibold text-[#8b8d9f] hover:text-white cursor-pointer"
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

  const totalGoals = habits.length;
  const completedTodayCount = habits.filter((h) => h.completedToday).length;
  const pendingGoals = habits.filter((h) => !h.completedToday);
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.currentStreak), 0);
  const totalLogsAllTime = habits.reduce(
    (sum, h) => sum + h.weeklyProgress.filter((d) => d.completed).length,
    0
  );

  const defaultDays = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
  const daysList = habits[0]?.weeklyProgress.map((d) => d.date) || [];
  const dailyStats =
    daysList.length > 0
      ? daysList.map((date, idx) => {
          const done = habits.reduce((acc, h) => {
            const p = h.weeklyProgress.find((x) => x.date === date);
            return acc + (p?.completed ? 1 : 0);
          }, 0);
          const pct = totalGoals > 0 ? Math.round((done / totalGoals) * 100) : 0;
          const isToday = idx === daysList.length - 1;
          const dayLetter = new Date(`${date}T00:00:00Z`).toLocaleDateString('en-US', {
            weekday: 'narrow',
            timeZone: 'UTC',
          });
          return { date, dayLetter, done, pct, isToday };
        })
      : defaultDays.map((d, idx) => ({
          date: d,
          dayLetter: d[0],
          done: 0,
          pct: 0,
          isToday: idx === 6,
        }));

  const weeklyAvgPct =
    dailyStats.length > 0
      ? Math.round(dailyStats.reduce((s, d) => s + d.pct, 0) / dailyStats.length)
      : 0;

  const dsaHabits = habits.filter((h) => h.category === 'DSA');
  const fullStackHabits = habits.filter((h) => h.category === 'Full-Stack');
  const secHabits = habits.filter(
    (h) => h.category === 'Cybersecurity' || h.category === 'System Design'
  );

  const dsaPct =
    dsaHabits.length > 0
      ? Math.round((dsaHabits.filter((h) => h.completedToday).length / dsaHabits.length) * 100)
      : 75;
  const fsPct =
    fullStackHabits.length > 0
      ? Math.round(
          (fullStackHabits.filter((h) => h.completedToday).length / fullStackHabits.length) * 100
        )
      : 60;
  const secPct =
    secHabits.length > 0
      ? Math.round((secHabits.filter((h) => h.completedToday).length / secHabits.length) * 100)
      : 85;

  const overallRingPct =
    totalGoals > 0 ? Math.round((completedTodayCount / totalGoals) * 100) : 0;

  const filteredHabits = habits
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

  const totalSegments = Math.max(totalGoals, 1);
  const yellowWidth = Math.max(Math.round((completedTodayCount / totalSegments) * 100), 18);
  const pinkWidth = Math.max(Math.round((pendingGoals.length / totalSegments) * 100), 25);

  const userFirstName = currentUser.name.split(' ')[0] || 'Developer';
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
      id: 'DASHBOARD_DSA',
      label: 'DSA & LeetCode',
      icon: Calendar,
      isActive: activePage === 'DASHBOARD' && activeFilter === 'DSA',
      onClick: () => {
        setActivePage('DASHBOARD');
        setActiveFilter('DSA');
      },
    },
    {
      id: 'DASHBOARD_FS',
      label: 'My Tasks',
      icon: CheckSquare,
      isActive: activePage === 'DASHBOARD' && activeFilter === 'Full-Stack',
      onClick: () => {
        setActivePage('DASHBOARD');
        setActiveFilter('Full-Stack');
      },
    },
    {
      id: 'PAGE_STATISTICS',
      label: 'Statistics',
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
    <div className="min-h-screen bg-[#0b0b10] text-[#f4f4f6] flex flex-col lg:flex-row selection:bg-[#7c5cfc] selection:text-white">
      {/* LEFT SIDEBAR */}
      <aside className="hidden lg:flex w-[250px] bg-[#0e0f15] border-r border-white/[0.05] flex-col justify-between py-8 px-6 shrink-0 fixed top-0 bottom-0 left-0 z-40">
        <div>
          <div className="flex items-center gap-3 px-2 mb-10">
            <div className="w-7 h-7 rounded-full border-[3px] border-[#7c5cfc] flex items-center justify-center shadow-[0_0_15px_rgba(124,92,252,0.5)]">
              <div className="w-2 h-2 rounded-full bg-[#ff4d94]" />
            </div>
            <span className="text-[19px] font-bold tracking-tight text-white">DevTrack</span>
          </div>

          <nav className="space-y-1.5">
            {sidebarItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={item.onClick}
                  className={`relative w-full flex items-center gap-3.5 px-3.5 py-2.5 rounded-xl text-[13.5px] font-medium transition-all cursor-pointer ${
                    item.isActive
                      ? 'text-white bg-white/[0.04]'
                      : 'text-[#7c7f93] hover:text-white hover:bg-white/[0.02]'
                  }`}
                >
                  <Icon
                    className={`w-[18px] h-[18px] ${
                      item.isActive ? 'text-white' : 'text-[#7c7f93]'
                    }`}
                  />
                  <span>{item.label}</span>
                  {item.isActive && (
                    <motion.div
                      layoutId="activeNavIndicator"
                      className="absolute right-0 top-1.5 bottom-1.5 w-[4px] rounded-l-full bg-[#7c5cfc] shadow-[0_0_12px_#7c5cfc]"
                    />
                  )}
                </button>
              );
            })}
          </nav>

          {/* INTEGRATIONS */}
          <div className="mt-9">
            <p className="px-3.5 text-[10.5px] font-bold tracking-[0.12em] text-[#565869] uppercase mb-3">
              Integrations
            </p>
            <div className="space-y-1.5">
              <button
                type="button"
                onClick={() => {
                  setActivePage('DASHBOARD');
                  setActiveFilter('LEETCODE');
                }}
                className={`w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13px] font-medium transition cursor-pointer ${
                  activePage === 'DASHBOARD' && activeFilter === 'LEETCODE'
                    ? 'text-white bg-[#7c5cfc]/15 border border-[#7c5cfc]/30'
                    : 'text-[#8b8d9f] hover:text-white'
                }`}
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-[#f5b014] shadow-[0_0_8px_#f5b014]" />
                <span>LeetCode GraphQL</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setVerificationType('MANUAL_PROOF');
                  setNewCategory('Full-Stack');
                  setShowAddForm(true);
                }}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13px] font-medium text-[#8b8d9f] hover:text-white transition cursor-pointer"
              >
                <span className="w-2.5 h-2.5 rounded-sm bg-[#ff4d94]" />
                <span>GitHub Proof Lock</span>
              </button>

              <button
                type="button"
                onClick={() => setShowAddForm(true)}
                className="w-full flex items-center gap-3 px-3.5 py-2 rounded-xl text-[13px] font-medium text-[#6c6f82] hover:text-white transition cursor-pointer mt-1"
              >
                <span className="w-5 h-5 rounded-full border border-dashed border-[#565869] flex items-center justify-center">
                  <Plus className="w-3 h-3" />
                </span>
                <span>Add new plugin</span>
              </button>
            </div>
          </div>
        </div>

        {/* Bottom Settings, Logout + Live Neon Status */}
        <div className="space-y-2.5 pt-4 border-t border-white/[0.05]">
          <div className="flex items-center gap-2.5 px-3 py-2 rounded-xl bg-[#151621] border border-white/[0.04]">
            <span
              className={`w-2 h-2 rounded-full ${
                isDbOnline ? 'bg-[#10b981] shadow-[0_0_8px_#10b981]' : 'bg-rose-500'
              }`}
            />
            <span className="text-[11.5px] font-medium text-[#9ca0b5]">
              {loading ? 'Syncing Neon DB...' : isDbOnline ? 'Neon DB Connected' : 'DB Offline'}
            </span>
          </div>
          <button
            type="button"
            onClick={handleEnableBrowserNotifications}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-[#7c7f93] hover:text-white transition cursor-pointer"
          >
            <Settings className="w-4 h-4" />
            <span>Notification Settings</span>
          </button>
          <button
            type="button"
            onClick={handleLogout}
            className="w-full flex items-center gap-3 px-3 py-1.5 text-[13px] text-rose-400 hover:text-rose-300 transition cursor-pointer"
          >
            <LogOut className="w-4 h-4" />
            <span>Sign Out</span>
          </button>
        </div>
      </aside>

      {/* MAIN CONTENT SHELL */}
      <main className="flex-1 lg:ml-[250px] px-4 sm:px-8 lg:px-10 py-6 lg:py-8 pb-24 lg:pb-12 max-w-[1440px] w-full mx-auto">
        {/* TOP HEADER BAR */}
        <header className="flex flex-wrap items-center justify-between gap-4 mb-8">
          <div>
            <h1 className="text-2xl sm:text-[30px] font-extrabold tracking-tight text-white">
              {activePage === 'STATISTICS'
                ? 'Developer Statistics 📊'
                : activePage === 'SECURITY'
                ? 'Security Labs & CTF 🛡️'
                : `Hi, ${userFirstName}!`}
            </h1>
            <p className="text-xs sm:text-[13px] text-[#7c7f93] mt-0.5">
              {todayStr} • Anti-Cheat Developer Growth & LeetCode Auto-Verification
            </p>
          </div>

          <div className="flex items-center gap-3 sm:gap-4">
            <AnimatePresence>
              {showSearch && (
                <motion.input
                  initial={{ width: 0, opacity: 0 }}
                  animate={{ width: 190, opacity: 1 }}
                  exit={{ width: 0, opacity: 0 }}
                  type="text"
                  value={searchQuery}
                  onChange={(e) => setSearchQuery(e.target.value)}
                  placeholder="Filter goals..."
                  className="bg-[#161722] border border-white/10 rounded-full px-3.5 py-1.5 text-xs text-white focus:outline-none focus:border-[#7c5cfc]"
                />
              )}
            </AnimatePresence>

            <button
              type="button"
              onClick={() => setShowAddForm(true)}
              className="bg-gradient-to-r from-[#6c47ff] to-[#7c5cfc] hover:from-[#5b36ec] hover:to-[#6c47ff] text-white font-semibold text-[13px] px-5 py-2.5 rounded-full shadow-[0_6px_20px_rgba(108,71,255,0.4)] flex items-center gap-2 transition transform active:scale-95 cursor-pointer"
            >
              <Plus className="w-4 h-4 stroke-[2.5]" />
              <span>Create</span>
            </button>

            <button
              type="button"
              onClick={() => setShowSearch((p) => !p)}
              className="w-9 h-9 rounded-full bg-[#161722] border border-white/[0.06] flex items-center justify-center text-[#8b8d9f] hover:text-white transition cursor-pointer"
              title="Search goals"
            >
              <Search className="w-4 h-4" />
            </button>

            <div className="relative">
              <button
                type="button"
                onClick={() => setShowNotifications((p) => !p)}
                className="w-9 h-9 rounded-full bg-[#161722] border border-white/[0.06] flex items-center justify-center text-[#8b8d9f] hover:text-white transition cursor-pointer relative"
                title="Pending Goal Reminders"
              >
                <Bell className="w-4 h-4" />
                {pendingGoals.length > 0 && (
                  <span className="absolute top-1.5 right-2 w-2 h-2 rounded-full bg-[#ff4d94] ring-2 ring-[#161722]" />
                )}
              </button>

              <AnimatePresence>
                {showNotifications && (
                  <motion.div
                    initial={{ opacity: 0, y: 8, scale: 0.96 }}
                    animate={{ opacity: 1, y: 0, scale: 1 }}
                    exit={{ opacity: 0, y: 8, scale: 0.96 }}
                    className="absolute right-0 mt-3 w-80 bg-[#171824] border border-white/10 rounded-2xl p-4 shadow-2xl z-50"
                  >
                    <div className="flex items-center justify-between mb-3">
                      <span className="text-xs font-bold text-white">
                        Pending Today ({pendingGoals.length})
                      </span>
                      <button
                        type="button"
                        onClick={handleEnableBrowserNotifications}
                        className="text-[11px] font-semibold text-[#7c5cfc] hover:underline cursor-pointer"
                      >
                        Enable Push Alerts
                      </button>
                    </div>
                    {pendingGoals.length === 0 ? (
                      <p className="text-xs text-emerald-400 py-2">All goals verified for today!</p>
                    ) : (
                      <div className="space-y-2 max-h-60 overflow-y-auto">
                        {pendingGoals.map((g) => (
                          <div
                            key={g.id}
                            className="p-2.5 rounded-xl bg-[#101119] border border-white/[0.05] text-xs"
                          >
                            <div className="font-semibold text-white">{g.title}</div>
                            <div className="text-[#7c7f93] text-[11px] mt-0.5">
                              {g.verificationType === 'LEETCODE'
                                ? `Solve ${g.dailyTargetCount} on LeetCode (@${g.leetcodeUsername}) & click Sync`
                                : 'Requires manual proof note before midnight'}
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
              className="w-9 h-9 rounded-full bg-gradient-to-tr from-[#7c5cfc] to-[#ff4d94] p-[2px]"
            >
              <div className="w-full h-full rounded-full bg-[#161722] flex items-center justify-center text-xs font-bold text-white">
                {userInitials || 'DP'}
              </div>
            </div>
          </div>
        </header>

        {/* Status Toast Banners */}
        <AnimatePresence>
          {error && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-rose-500/10 border border-rose-500/30 text-rose-300 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2.5">
                <AlertCircle className="w-4 h-4 text-rose-400 shrink-0" />
                <span>{error}</span>
              </div>
              <button onClick={() => setError(null)} className="text-rose-400 hover:text-white">
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
          {successMsg && (
            <motion.div
              initial={{ opacity: 0, y: -6 }}
              animate={{ opacity: 1, y: 0 }}
              exit={{ opacity: 0, y: -6 }}
              className="mb-6 flex items-center justify-between gap-3 px-4 py-3 rounded-2xl bg-emerald-500/10 border border-emerald-500/30 text-emerald-300 text-xs sm:text-sm"
            >
              <div className="flex items-center gap-2.5">
                <CheckCircle2 className="w-4 h-4 text-emerald-400 shrink-0" />
                <span>{successMsg}</span>
              </div>
              <button
                onClick={() => setSuccessMsg(null)}
                className="text-emerald-400 hover:text-white"
              >
                <X className="w-4 h-4" />
              </button>
            </motion.div>
          )}
        </AnimatePresence>

        {/* PAGE ROUTER */}
        {activePage === 'STATISTICS' ? (
          <StatisticsView habits={habits} todayStr={todayStr} />
        ) : activePage === 'SECURITY' ? (
          <SecurityLabsView
            habits={habits}
            onQuickCreateLab={handleQuickCreateSecurityLab}
            onSubmitLabProof={executeToggle}
            onUncheckLab={(habitId) => executeToggle(habitId, '')}
            onDeleteLab={handleDelete}
          />
        ) : (
          <>
            {/* TOP 3-COLUMN BENTO ANALYTICS ROW */}
            <section className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6 mb-7">
              <div className="bg-[#151621] border border-white/[0.05] rounded-[26px] p-6 flex flex-col justify-between shadow-xl">
                <div className="flex items-center justify-between mb-4">
                  <h2 className="text-[16px] font-bold text-white">Overall Information</h2>
                  <div className="flex items-center gap-2 text-[#6c6f82]">
                    <Share2 className="w-4 h-4 hover:text-white cursor-pointer transition" />
                    <MoreVertical className="w-4 h-4 hover:text-white cursor-pointer transition" />
                  </div>
                </div>

                <div className="flex items-baseline gap-6 my-2">
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-4xl font-extrabold text-white tracking-tight">
                      {totalLogsAllTime}
                    </span>
                    <span className="text-[11px] leading-tight text-[#7c7f93] max-w-[70px]">
                      Tasks done this week
                    </span>
                  </div>
                  <div className="h-8 w-[1px] bg-white/[0.08]" />
                  <div className="flex items-baseline gap-2.5">
                    <span className="text-4xl font-extrabold text-white tracking-tight">
                      {bestStreak}
                    </span>
                    <span className="text-[11px] leading-tight text-[#7c7f93] max-w-[70px]">
                      Best day streak 🔥
                    </span>
                  </div>
                </div>

                <div className="w-full h-2 rounded-full bg-[#232433] overflow-hidden flex my-4">
                  <div
                    style={{ width: `${yellowWidth}%` }}
                    className="bg-[#f5b014] h-full rounded-l-full transition-all duration-500"
                  />
                  <div
                    style={{ width: `${pinkWidth}%` }}
                    className="bg-[#ff4d94] h-full transition-all duration-500"
                  />
                  <div className="flex-1 bg-[#6c47ff] h-full rounded-r-full" />
                </div>

                <div className="grid grid-cols-3 gap-3 mt-1">
                  <div className="bg-gradient-to-b from-[#7451ff] to-[#5936e8] rounded-[20px] p-3.5 text-center text-white shadow-[0_8px_20px_rgba(108,71,255,0.28)]">
                    <div className="w-6 h-6 rounded-full bg-white/15 mx-auto mb-1.5 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full bg-white" />
                    </div>
                    <div className="text-2xl font-extrabold leading-none">{totalGoals}</div>
                    <div className="text-[11px] font-medium text-white/80 mt-1">Goals</div>
                  </div>

                  <div className="bg-gradient-to-b from-[#ff5599] to-[#e62e78] rounded-[20px] p-3.5 text-center text-white shadow-[0_8px_20px_rgba(255,77,148,0.25)]">
                    <div className="w-6 h-6 rounded-full bg-white/15 mx-auto mb-1.5 flex items-center justify-center">
                      <div className="w-2.5 h-2.5 rounded-full border border-dashed border-white" />
                    </div>
                    <div className="text-2xl font-extrabold leading-none">{pendingGoals.length}</div>
                    <div className="text-[11px] font-medium text-white/80 mt-1">In Progress</div>
                  </div>

                  <div className="bg-gradient-to-b from-[#ffc226] to-[#eda008] rounded-[20px] p-3.5 text-center text-[#12131a] shadow-[0_8px_20px_rgba(245,176,20,0.25)]">
                    <div className="w-6 h-6 rounded-full bg-black/10 mx-auto mb-1.5 flex items-center justify-center">
                      <Check className="w-3.5 h-3.5 stroke-[3]" />
                    </div>
                    <div className="text-2xl font-extrabold leading-none">{completedTodayCount}</div>
                    <div className="text-[11px] font-bold text-[#12131a]/80 mt-1">Completed</div>
                  </div>
                </div>
              </div>

              {/* CARD 2: Weekly progress */}
              <div className="bg-[#151621] border border-white/[0.05] rounded-[26px] p-6 flex flex-col justify-between shadow-xl relative">
                <div className="flex items-center justify-between mb-2">
                  <h2 className="text-[16px] font-bold text-white">Weekly progress</h2>
                  <div className="flex items-center gap-2">
                    <span className="bg-white text-[#12131a] text-[11px] font-extrabold px-2.5 py-0.5 rounded-lg shadow">
                      {weeklyAvgPct}% wk
                    </span>
                    <Flame className="w-4 h-4 text-[#f5b014]" />
                  </div>
                </div>

                <div className="grid grid-cols-7 gap-3 items-end h-[148px] pt-4 px-2">
                  {dailyStats.map((st) => (
                    <div
                      key={st.date}
                      className="flex flex-col items-center gap-2.5 h-full justify-end"
                    >
                      <div className="w-[8px] sm:w-[9px] h-[108px] rounded-full bg-[#242636] flex items-end overflow-hidden">
                        <motion.div
                          initial={{ height: 0 }}
                          animate={{ height: `${Math.max(st.pct, 12)}%` }}
                          transition={{ duration: 0.5 }}
                          className={`w-full rounded-full ${
                            st.pct === 100
                              ? 'bg-gradient-to-t from-[#f59e0b] to-[#fbbf24] shadow-[0_0_10px_rgba(251,191,36,0.5)]'
                              : st.pct > 0
                              ? 'bg-gradient-to-t from-[#7c5cfc] to-[#a78bfa]'
                              : 'bg-[#32354a]'
                          }`}
                        />
                      </div>
                      <span
                        className={`text-[11px] font-bold ${
                          st.isToday ? 'text-[#f5b014]' : 'text-[#6c6f82]'
                        }`}
                      >
                        {st.dayLetter}
                      </span>
                    </div>
                  ))}
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-xs text-[#7c7f93]">
                  <div className="flex items-center gap-2">
                    <span className="w-2 h-2 rounded-full bg-[#f5b014]" />
                    <span>Verified Streak</span>
                  </div>
                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="flex items-center gap-1.5 text-[#8b8d9f] hover:text-white cursor-pointer"
                  >
                    <span>Add target</span>
                    <span className="w-5 h-5 rounded-full border border-dashed border-[#565869] flex items-center justify-center">
                      <Plus className="w-3 h-3" />
                    </span>
                  </button>
                </div>
              </div>

              {/* CARD 3: Category Progress */}
              <div className="bg-[#151621] border border-white/[0.05] rounded-[26px] p-6 flex flex-col justify-between shadow-xl md:col-span-2 xl:col-span-1">
                <div>
                  <div className="flex items-center justify-between">
                    <h2 className="text-[16px] font-bold text-white">Category Progress</h2>
                    <BarChart3 className="w-4 h-4 text-[#6c6f82]" />
                  </div>
                  <p className="text-[11.5px] text-[#7c7f93] mt-0.5">
                    <span className="text-[#f5b014] font-semibold">+{overallRingPct}%</span> verified
                    completion rate
                  </p>
                </div>

                <div className="flex items-center justify-between gap-4 my-2">
                  <div className="space-y-2.5 text-xs">
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#f5b014]" />
                      <span className="text-[#9ca0b5]">DSA / LeetCode</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#7c5cfc]" />
                      <span className="text-[#9ca0b5]">Full-Stack Dev</span>
                    </div>
                    <div className="flex items-center gap-2.5">
                      <span className="w-2 h-2 rounded-full bg-[#ff4d94]" />
                      <span className="text-[#9ca0b5]">System / Sec</span>
                    </div>
                  </div>

                  <div className="relative w-[132px] h-[132px] flex items-center justify-center shrink-0">
                    <svg className="w-full h-full -rotate-90" viewBox="0 0 120 120">
                      <circle cx="60" cy="60" r="50" fill="none" stroke="#232433" strokeWidth="6" />
                      <circle
                        cx="60"
                        cy="60"
                        r="50"
                        fill="none"
                        stroke="#f5b014"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="314"
                        strokeDashoffset={314 - (314 * dsaPct) / 100}
                      />
                      <circle cx="60" cy="60" r="39" fill="none" stroke="#232433" strokeWidth="6" />
                      <circle
                        cx="60"
                        cy="60"
                        r="39"
                        fill="none"
                        stroke="#ff4d94"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="245"
                        strokeDashoffset={245 - (245 * secPct) / 100}
                      />
                      <circle cx="60" cy="60" r="28" fill="none" stroke="#232433" strokeWidth="6" />
                      <circle
                        cx="60"
                        cy="60"
                        r="28"
                        fill="none"
                        stroke="#7c5cfc"
                        strokeWidth="6"
                        strokeLinecap="round"
                        strokeDasharray="176"
                        strokeDashoffset={176 - (176 * fsPct) / 100}
                      />
                    </svg>
                    <div className="absolute inset-0 flex flex-col items-center justify-center text-center">
                      <span className="text-lg font-extrabold text-white">{overallRingPct}%</span>
                      <span className="text-[9px] uppercase tracking-wider text-[#7c7f93]">Done</span>
                    </div>
                  </div>
                </div>

                <div className="flex items-center justify-between pt-3 border-t border-white/[0.04] text-xs text-[#7c7f93]">
                  <Share2 className="w-3.5 h-3.5 hover:text-white cursor-pointer" />
                  <span className="flex items-center gap-1.5 text-[#9ca0b5]">
                    <span>Anti-Cheat Protected</span>
                    <Download className="w-3.5 h-3.5" />
                  </span>
                </div>
              </div>
            </section>

            {/* MIDDLE BENTO ROW */}
            <section className="grid grid-cols-1 xl:grid-cols-12 gap-6 mb-8">
              <div className="xl:col-span-4 bg-[#151621] border border-white/[0.05] rounded-[26px] p-6 flex flex-col justify-between shadow-xl">
                <div>
                  <div className="flex items-center justify-between mb-5">
                    <h2 className="text-[16px] font-bold text-white">Today's Checklist:</h2>
                    <div className="flex items-center gap-2">
                      <span className="text-[11px] font-bold px-2.5 py-1 rounded-full bg-[#232433] text-[#f5b014]">
                        {completedTodayCount}/{totalGoals}
                      </span>
                      <button
                        type="button"
                        onClick={() => setShowAddForm(true)}
                        className="w-7 h-7 rounded-full bg-[#232433] flex items-center justify-center text-[#9ca0b5] hover:text-white cursor-pointer"
                      >
                        <Edit3 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  {habits.length === 0 ? (
                    <p className="text-xs text-[#7c7f93] py-4">
                      No goals yet. Pick a developer template below to get started!
                    </p>
                  ) : (
                    <div className="space-y-3 mb-6">
                      {habits.map((h) => (
                        <div
                          key={h.id}
                          onClick={() =>
                            h.verificationType === 'LEETCODE'
                              ? handleVerifyLeetCode(h.id)
                              : handleToggleManual(h.id)
                          }
                          className="flex items-center justify-between gap-3 p-2.5 rounded-xl hover:bg-white/[0.02] transition cursor-pointer group"
                        >
                          <div className="flex items-center gap-3">
                            <div
                              className={`w-5 h-5 rounded-md flex items-center justify-center transition ${
                                h.completedToday
                                  ? 'bg-[#f5b014] text-[#12131a]'
                                  : 'border border-[#45485e] group-hover:border-[#7c5cfc]'
                              }`}
                            >
                              {h.completedToday && <Check className="w-3.5 h-3.5 stroke-[3]" />}
                            </div>
                            <span
                              className={`text-[13.5px] font-medium ${
                                h.completedToday ? 'text-white' : 'text-[#8b8d9f]'
                              }`}
                            >
                              {h.title}
                            </span>
                          </div>
                          <span className="text-[10.5px] font-semibold px-2 py-0.5 rounded-md bg-[#1e2030] text-[#8b8d9f]">
                            {h.verificationType === 'LEETCODE' ? 'LeetCode' : 'Proof'}
                          </span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>

                <div className="pt-4 border-t border-white/[0.05]">
                  <p className="text-[11px] font-bold uppercase tracking-wider text-[#6c6f82] mb-2.5">
                    Quick Developer Templates
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {PRESET_GOALS.slice(0, 3).map((preset) => (
                      <button
                        key={preset.title}
                        type="button"
                        onClick={() => {
                          setNewTitle(preset.title);
                          setNewCategory(preset.category);
                          setVerificationType(preset.verificationType);
                          setDailyTargetCount(preset.dailyTargetCount);
                          setShowAddForm(true);
                        }}
                        className="text-[11px] font-medium px-2.5 py-1.5 rounded-xl bg-[#1d1f2e] hover:bg-[#7c5cfc]/20 text-[#9ca0b5] hover:text-white border border-white/[0.04] transition cursor-pointer"
                      >
                        + {preset.title}
                      </button>
                    ))}
                  </div>
                </div>
              </div>

              {/* RIGHT 8 COLS: Task In process */}
              <div className="xl:col-span-8 flex flex-col justify-between">
                <div className="flex items-center justify-between mb-4 px-1">
                  <h2 className="text-[17px] font-bold text-white">
                    Task In process ({filteredHabits.length})
                  </h2>
                  <span className="flex items-center gap-1 text-xs text-[#7c7f93]">
                    <Lock className="w-3.5 h-3.5 text-[#f5b014]" />
                    <span>Past days locked (Anti-Cheat)</span>
                    <ChevronRight className="w-4 h-4" />
                  </span>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-5 flex-1">
                  {filteredHabits.map((habit, index) => {
                    const isVerifying = verifyingId === habit.id;
                    const isProofOpen = proofInputHabitId === habit.id;
                    const isPinned = pinnedIds.includes(habit.id);
                    const isFeatured = index === 0 || habit.completedToday;

                    return (
                      <motion.div
                        layout
                        key={habit.id}
                        className={`relative rounded-[26px] p-5 flex flex-col justify-between min-h-[225px] transition-all overflow-hidden ${
                          isFeatured
                            ? 'bg-gradient-to-br from-[#1b1c2e] to-[#151622] border border-[#7c5cfc]/45 shadow-[0_12px_30px_rgba(108,71,255,0.12)]'
                            : 'bg-[#151621] border border-white/[0.05] hover:border-white/15'
                        }`}
                      >
                        <div>
                          <div className="flex items-center justify-between mb-4">
                            <div className="flex items-center gap-2">
                              <div className="w-10 h-10 rounded-2xl bg-[#212334] flex items-center justify-center">
                                {getCategoryIcon(habit.category)}
                              </div>
                              <div>
                                <span className="text-[10.5px] font-bold uppercase tracking-wider text-[#7c7f93] block">
                                  {habit.category}
                                </span>
                                <span className="text-[11px] font-bold text-[#f5b014]">
                                  🔥 {habit.currentStreak}d streak {isPinned ? '• 📌' : ''}
                                </span>
                              </div>
                            </div>

                            <div className="relative">
                              <button
                                type="button"
                                onClick={() =>
                                  setOpenMenuHabitId(openMenuHabitId === habit.id ? null : habit.id)
                                }
                                className="w-8 h-8 rounded-full hover:bg-white/5 flex items-center justify-center text-[#7c7f93] hover:text-white cursor-pointer"
                              >
                                <MoreHorizontal className="w-5 h-5" />
                              </button>

                              <AnimatePresence>
                                {openMenuHabitId === habit.id && (
                                  <motion.div
                                    initial={{ opacity: 0, scale: 0.9, y: -4 }}
                                    animate={{ opacity: 1, scale: 1, y: 0 }}
                                    exit={{ opacity: 0, scale: 0.9, y: -4 }}
                                    className="absolute right-0 top-9 w-36 bg-[#6c47ff] text-white rounded-2xl p-2 shadow-2xl z-30 space-y-1"
                                  >
                                    <button
                                      type="button"
                                      onClick={() => togglePin(habit.id)}
                                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-white/15 cursor-pointer"
                                    >
                                      <span>{isPinned ? 'Unpin' : 'Pin Goal'}</span>
                                      <Pin className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => {
                                        setOpenMenuHabitId(null);
                                        if (habit.verificationType === 'LEETCODE') {
                                          handleVerifyLeetCode(habit.id);
                                        } else {
                                          handleToggleManual(habit.id);
                                        }
                                      }}
                                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-white/15 cursor-pointer"
                                    >
                                      <span>Verify Now</span>
                                      <Edit3 className="w-3.5 h-3.5" />
                                    </button>
                                    <button
                                      type="button"
                                      onClick={() => handleDelete(habit.id)}
                                      className="w-full flex items-center justify-between px-3 py-1.5 rounded-xl text-xs font-semibold hover:bg-rose-500/40 cursor-pointer"
                                    >
                                      <span>Delete</span>
                                      <Trash2 className="w-3.5 h-3.5" />
                                    </button>
                                  </motion.div>
                                )}
                              </AnimatePresence>
                            </div>
                          </div>

                          <h3 className="text-[15.5px] font-bold text-white leading-snug mb-1.5">
                            {habit.title}
                          </h3>

                          {habit.verificationType === 'LEETCODE' ? (
                            <p className="text-[11.5px] text-[#8b8d9f]">
                              LeetCode Auto:{' '}
                              <strong className="text-white">@{habit.leetcodeUsername}</strong> (
                              {habit.dailyTargetCount}/day)
                            </p>
                          ) : (
                            <p className="text-[11.5px] text-[#8b8d9f]">
                              {habit.todayNote
                                ? `✓ "${habit.todayNote}"`
                                : 'Requires daily proof note'}
                            </p>
                          )}

                          {isProofOpen && (
                            <div className="mt-3 p-2.5 rounded-2xl bg-[#101119] border border-[#7c5cfc]/40">
                              <input
                                type="text"
                                value={proofNote}
                                onChange={(e) => setProofNote(e.target.value)}
                                placeholder="Commit link or study summary..."
                                className="w-full bg-transparent text-xs text-white focus:outline-none mb-2"
                                autoFocus
                              />
                              <div className="flex justify-end gap-1.5">
                                <button
                                  type="button"
                                  onClick={() => setProofInputHabitId(null)}
                                  className="text-[11px] px-2.5 py-1 rounded-lg text-[#7c7f93] hover:text-white"
                                >
                                  Cancel
                                </button>
                                <button
                                  type="button"
                                  onClick={() => executeToggle(habit.id, proofNote)}
                                  className="text-[11px] font-bold px-3 py-1 rounded-lg bg-[#6c47ff] text-white"
                                >
                                  Submit Proof
                                </button>
                              </div>
                            </div>
                          )}
                        </div>

                        <div className="flex items-end justify-between mt-5 pt-3 border-t border-white/[0.05]">
                          <div className="flex items-center gap-1">
                            {habit.weeklyProgress.map((day, idx) => {
                              const isToday = idx === habit.weeklyProgress.length - 1;
                              const letter = new Date(`${day.date}T00:00:00Z`).toLocaleDateString(
                                'en-US',
                                { weekday: 'narrow', timeZone: 'UTC' }
                              );
                              return (
                                <div
                                  key={day.date}
                                  title={`${day.date}: ${
                                    day.completed ? 'Verified' : isToday ? 'Today' : 'Locked'
                                  }`}
                                  className={`w-6 h-7 rounded-lg flex flex-col items-center justify-center text-[10px] font-bold ${
                                    day.completed
                                      ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/40'
                                      : isToday
                                      ? 'bg-[#7c5cfc]/20 text-white border border-[#7c5cfc]'
                                      : 'bg-[#101119] text-[#565869]'
                                  }`}
                                >
                                  <span>{letter}</span>
                                  <span className="text-[7px]">
                                    {day.completed ? '●' : isToday ? '◎' : '🔒'}
                                  </span>
                                </div>
                              );
                            })}
                          </div>

                          {habit.verificationType === 'LEETCODE' ? (
                            <button
                              type="button"
                              disabled={isVerifying}
                              onClick={() => handleVerifyLeetCode(habit.id)}
                              title="Sync with LeetCode GraphQL"
                              className={`px-3.5 py-2.5 rounded-2xl text-xs font-bold flex items-center gap-1.5 transition cursor-pointer shadow-lg ${
                                habit.completedToday
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-[#6c47ff] hover:bg-[#5936e8] text-white shadow-[0_6px_18px_rgba(108,71,255,0.45)]'
                              }`}
                            >
                              <RefreshCw
                                className={`w-3.5 h-3.5 ${isVerifying ? 'animate-spin' : ''}`}
                              />
                              <span>{habit.completedToday ? 'Done' : 'Sync'}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => handleToggleManual(habit.id)}
                              className={`w-10 h-10 rounded-2xl flex items-center justify-center transition cursor-pointer shadow-lg ${
                                habit.completedToday
                                  ? 'bg-emerald-500 text-slate-950'
                                  : 'bg-[#6c47ff] hover:bg-[#5936e8] text-white shadow-[0_6px_18px_rgba(108,71,255,0.45)]'
                              }`}
                            >
                              {habit.completedToday ? (
                                <Check className="w-4 h-4 stroke-[3]" />
                              ) : (
                                <Plus className="w-4 h-4 stroke-[2.5]" />
                              )}
                            </button>
                          )}
                        </div>
                      </motion.div>
                    );
                  })}

                  <button
                    type="button"
                    onClick={() => setShowAddForm(true)}
                    className="rounded-[26px] border-2 border-dashed border-white/[0.08] hover:border-[#7c5cfc]/60 bg-[#12131c]/40 hover:bg-[#151621] min-h-[225px] flex items-center justify-center gap-2.5 text-[#8b8d9f] hover:text-white font-semibold text-sm transition cursor-pointer group"
                  >
                    <Plus className="w-5 h-5 group-hover:scale-110 transition" />
                    <span>Add task</span>
                  </button>
                </div>
              </div>
            </section>
          </>
        )}
      </main>

      {/* CREATE GOAL MODAL */}
      <AnimatePresence>
        {showAddForm && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="fixed inset-0 bg-black/75 backdrop-blur-sm z-50 flex items-center justify-center p-4"
          >
            <motion.div
              initial={{ scale: 0.94, y: 12 }}
              animate={{ scale: 1, y: 0 }}
              exit={{ scale: 0.94, y: 12 }}
              className="bg-[#161722] border border-white/10 rounded-[28px] max-w-lg w-full p-6 sm:p-7 shadow-2xl"
            >
              <div className="flex items-center justify-between mb-5">
                <div>
                  <h2 className="text-lg font-extrabold text-white">Create Developer Goal</h2>
                  <p className="text-xs text-[#7c7f93]">
                    Choose a preset template or configure custom LeetCode / Proof verification
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="w-8 h-8 rounded-full bg-white/5 flex items-center justify-center text-[#8b8d9f] hover:text-white cursor-pointer"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>

              <div className="mb-5">
                <label className="text-[11px] font-bold uppercase tracking-wider text-[#6c6f82] block mb-2">
                  1-Click Developer Templates
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
                      className={`text-left p-2.5 rounded-2xl border transition cursor-pointer ${
                        newTitle === p.title
                          ? 'bg-[#6c47ff]/20 border-[#7c5cfc] text-white'
                          : 'bg-[#101119] border-white/[0.05] text-[#9ca0b5] hover:border-white/15'
                      }`}
                    >
                      <div className="text-xs font-bold text-white">{p.title}</div>
                      <div className="text-[10.5px] text-[#7c7f93] mt-0.5">{p.desc}</div>
                    </button>
                  ))}
                </div>
              </div>

              <form onSubmit={handleCreateHabit} className="space-y-4">
                <div>
                  <label className="text-xs font-semibold text-[#9ca0b5] block mb-1.5">
                    Goal Title
                  </label>
                  <input
                    type="text"
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g., Solve 2 LeetCode Mediums"
                    required
                    className="w-full bg-[#0e0f17] border border-white/10 rounded-xl px-3.5 py-2.5 text-sm text-white focus:outline-none focus:border-[#7c5cfc]"
                  />
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="text-xs font-semibold text-[#9ca0b5] block mb-1.5">
                      Category
                    </label>
                    <select
                      value={newCategory}
                      onChange={(e) => setNewCategory(e.target.value)}
                      className="w-full bg-[#0e0f17] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7c5cfc]"
                    >
                      <option value="DSA">DSA & LeetCode</option>
                      <option value="Full-Stack">Full-Stack Dev</option>
                      <option value="System Design">System Design</option>
                      <option value="Cybersecurity">Cybersecurity</option>
                    </select>
                  </div>

                  <div>
                    <label className="text-xs font-semibold text-[#9ca0b5] block mb-1.5">
                      Verification Mode
                    </label>
                    <select
                      value={verificationType}
                      onChange={(e) =>
                        setVerificationType(e.target.value as 'MANUAL_PROOF' | 'LEETCODE')
                      }
                      className="w-full bg-[#0e0f17] border border-white/10 rounded-xl px-3 py-2.5 text-sm text-white focus:outline-none focus:border-[#7c5cfc]"
                    >
                      <option value="LEETCODE">LeetCode Auto-Sync</option>
                      <option value="MANUAL_PROOF">Manual Proof Lock</option>
                    </select>
                  </div>
                </div>

                {verificationType === 'LEETCODE' && (
                  <div className="grid grid-cols-3 gap-3 p-3.5 rounded-2xl bg-[#101119] border border-[#7c5cfc]/30">
                    <div className="col-span-2">
                      <label className="text-[11px] font-semibold text-[#9ca0b5] block mb-1">
                        LeetCode Username
                      </label>
                      <input
                        type="text"
                        value={leetcodeUsername}
                        onChange={(e) => setLeetcodeUsername(e.target.value)}
                        placeholder="divypatel31"
                        required
                        className="w-full bg-[#161722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                    <div>
                      <label className="text-[11px] font-semibold text-[#9ca0b5] block mb-1">
                        Daily Target
                      </label>
                      <input
                        type="number"
                        min={1}
                        max={15}
                        value={dailyTargetCount}
                        onChange={(e) => setDailyTargetCount(Number(e.target.value))}
                        className="w-full bg-[#161722] border border-white/10 rounded-xl px-3 py-2 text-xs text-white"
                      />
                    </div>
                  </div>
                )}

                <div className="flex justify-end gap-2.5 pt-2">
                  <button
                    type="button"
                    onClick={() => setShowAddForm(false)}
                    className="px-4 py-2.5 rounded-xl text-xs font-semibold text-[#8b8d9f] hover:text-white cursor-pointer"
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submitting}
                    className="bg-gradient-to-r from-[#6c47ff] to-[#7c5cfc] text-white text-xs font-bold px-6 py-2.5 rounded-xl shadow-lg cursor-pointer"
                  >
                    {submitting ? 'Creating...' : 'Create Goal'}
                  </button>
                </div>
              </form>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* MOBILE BOTTOM NAVIGATION BAR */}
      <nav className="lg:hidden fixed bottom-0 left-0 right-0 bg-[#12131c]/95 backdrop-blur-md border-t border-white/[0.06] px-4 py-2.5 flex items-center justify-around z-40">
        <button
          type="button"
          onClick={() => {
            setActivePage('DASHBOARD');
            setActiveFilter('ALL');
          }}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
            activePage === 'DASHBOARD' ? 'text-[#7c5cfc]' : 'text-[#7c7f93]'
          }`}
        >
          <LayoutGrid className="w-4 h-4" />
          <span>Dashboard</span>
        </button>
        <button
          type="button"
          onClick={() => setActivePage('STATISTICS')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
            activePage === 'STATISTICS' ? 'text-[#f5b014]' : 'text-[#7c7f93]'
          }`}
        >
          <BarChart3 className="w-4 h-4" />
          <span>Statistics</span>
        </button>
        <button
          type="button"
          onClick={() => setShowAddForm(true)}
          className="w-10 h-10 rounded-full bg-gradient-to-r from-[#6c47ff] to-[#7c5cfc] flex items-center justify-center text-white shadow-lg -mt-4"
        >
          <Plus className="w-5 h-5" />
        </button>
        <button
          type="button"
          onClick={() => setActivePage('SECURITY')}
          className={`flex flex-col items-center gap-1 text-[10px] font-semibold ${
            activePage === 'SECURITY' ? 'text-emerald-400' : 'text-[#7c7f93]'
          }`}
        >
          <Shield className="w-4 h-4" />
          <span>Security</span>
        </button>
        <button
          type="button"
          onClick={handleLogout}
          className="flex flex-col items-center gap-1 text-[10px] font-semibold text-rose-400"
        >
          <LogOut className="w-4 h-4" />
          <span>Sign Out</span>
        </button>
      </nav>
    </div>
  );
}

export default App;