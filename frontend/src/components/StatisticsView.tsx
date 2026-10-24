import { useState } from 'react';
import { motion } from 'framer-motion';
import {
  BarChart3,
  Flame,
  CheckCircle2,
  Award,
  Clock,
  ShieldCheck,
  TrendingUp,
  Calendar,
  Check,
} from 'lucide-react';
import type { Habit, UserHabitAnalytics } from '../types/habit';

interface StatisticsViewProps {
  habits: Habit[];
  analytics: UserHabitAnalytics | null;
  todayStr: string;
}

const WEEKDAY_LABELS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

export function StatisticsView({ habits, analytics, todayStr }: StatisticsViewProps) {
  const [trendRange, setTrendRange] = useState<'7D' | '30D'>('30D');

  const todayScheduled = analytics?.todayScheduledCount ?? habits.length;
  const todayCompleted =
    analytics?.todayCompletedCount ?? habits.filter((h) => h.completedToday).length;
  const todayPct =
    analytics?.todayCompletionPercentage ??
    (todayScheduled > 0 ? Math.round((todayCompleted / todayScheduled) * 100) : 0);

  const weeklyPct = analytics?.weeklyCompletionPercentage ?? 0;
  const thirtyDayPct = analytics?.thirtyDayCompletionPercentage ?? 0;
  const currentStreak =
    analytics?.currentStreak ?? habits.reduce((max, h) => Math.max(max, h.currentStreak), 0);
  const longestStreak =
    analytics?.longestStreak ??
    habits.reduce((max, h) => Math.max(max, h.longestStreak || h.currentStreak), 0);
  const totalScheduledCompleted =
    analytics?.totalCompletedScheduledHabits ??
    habits.reduce((sum, h) => sum + h.weeklyProgress.filter((d) => d.completed).length, 0);

  const activeTrend =
    trendRange === '7D' ? analytics?.trend7Days || [] : analytics?.trend30Days || [];

  const categories = ['DSA', 'Full-Stack', 'System Design', 'Cybersecurity'];
  const categoryStats = categories.map((cat) => {
    const catHabits = habits.filter((h) => h.category === cat);
    const catScheduled = catHabits.reduce(
      (sum, h) => sum + h.weeklyProgress.filter((d) => d.isScheduled !== false).length,
      0
    );
    const catLogs = catHabits.reduce(
      (sum, h) =>
        sum + h.weeklyProgress.filter((d) => d.isScheduled !== false && d.completed).length,
      0
    );
    const pct = catScheduled > 0 ? Math.round((catLogs / catScheduled) * 100) : 0;
    return {
      category: cat,
      goalCount: catHabits.length,
      completedLogs: catLogs,
      pct,
    };
  });

  const verifiedAuditLogs = habits.flatMap((h) =>
    h.weeklyProgress
      .filter((d) => d.completed)
      .map((d) => ({
        id: `${h.id}-${d.date}`,
        habitTitle: h.title,
        category: h.category,
        verificationType: h.verificationType,
        date: d.date,
        note:
          d.note ||
          (h.verificationType === 'LEETCODE'
            ? `Verified via LeetCode (@${h.leetcodeUsername})`
            : 'Completed check-in'),
      }))
  );

  verifiedAuditLogs.sort((a, b) => b.date.localeCompare(a.date));

  const dayColumns = habits[0]?.weeklyProgress.map((d) => d.date) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.2 }}
      className="space-y-6"
    >
      {/* Top 4 KPI Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-4 sm:gap-5 tabular-nums">
        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex items-start justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Today's Progress</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{todayPct}%</h3>
            <p className="text-xs text-slate-500 mt-1">
              {todayCompleted} of {todayScheduled} scheduled ({todayStr})
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <Award className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex items-start justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Weekly Consistency</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">{weeklyPct}%</h3>
            <p className="text-xs text-emerald-600 font-medium mt-1 flex items-center gap-1">
              <TrendingUp className="w-3.5 h-3.5" /> 30-day average: {thirtyDayPct}%
            </p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-emerald-50 border border-emerald-100 flex items-center justify-center text-emerald-600 shrink-0">
            <BarChart3 className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex items-start justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Active / Best Streak</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
              {currentStreak}d{' '}
              <span className="text-base font-semibold text-slate-400">/ {longestStreak}d</span>
            </h3>
            <p className="text-xs text-slate-500 mt-1">Rest days never break streaks</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-amber-50 border border-amber-100 flex items-center justify-center text-amber-600 shrink-0">
            <Flame className="w-5 h-5" />
          </div>
        </div>

        <div className="bg-white border border-slate-200/90 rounded-2xl p-5 flex items-start justify-between shadow-xs">
          <div>
            <p className="text-xs font-semibold text-slate-500">Verified Check-ins</p>
            <h3 className="text-3xl font-extrabold text-slate-900 mt-1">
              {totalScheduledCompleted}
            </h3>
            <p className="text-xs text-slate-500 mt-1">All-time scheduled completions</p>
          </div>
          <div className="w-10 h-10 rounded-xl bg-teal-50 border border-teal-100 flex items-center justify-center text-teal-600 shrink-0">
            <Calendar className="w-5 h-5" />
          </div>
        </div>
      </div>

      {/* Daily Scheduled Completion Trend Chart */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex flex-wrap items-center justify-between gap-3 mb-6">
          <div>
            <h2 className="text-base font-bold text-slate-900">
              Daily Completion Trend ({trendRange === '7D' ? 'Last 7 Days' : 'Last 30 Days'})
            </h2>
            <p className="text-xs text-slate-500 mt-0.5">
              Share of scheduled habits completed each day (unscheduled rest days are never
              counted as missed)
            </p>
          </div>

          <div className="flex items-center gap-1 bg-slate-100 p-1 rounded-xl border border-slate-200/70">
            <button
              type="button"
              onClick={() => setTrendRange('7D')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                trendRange === '7D'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              7 Days
            </button>
            <button
              type="button"
              onClick={() => setTrendRange('30D')}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition cursor-pointer ${
                trendRange === '30D'
                  ? 'bg-white text-slate-900 shadow-2xs'
                  : 'text-slate-600 hover:text-slate-900'
              }`}
            >
              30 Days
            </button>
          </div>
        </div>

        <div className="grid grid-cols-7 sm:grid-cols-15 lg:grid-cols-30 gap-1.5 items-end h-36 pt-4 px-1 tabular-nums">
          {activeTrend.map((pt) => (
            <div
              key={pt.date}
              title={`${pt.date}: ${pt.completedCount}/${pt.scheduledCount} completed (${pt.completionPercentage}%)`}
              className="flex flex-col items-center justify-end h-full gap-1.5"
            >
              <div className="w-full max-w-[14px] h-24 rounded-full bg-slate-100 flex items-end overflow-hidden">
                <div
                  style={{
                    height: `${
                      pt.scheduledCount === 0 ? 8 : Math.max(pt.completionPercentage, 10)
                    }%`,
                  }}
                  className={`w-full rounded-full transition-all duration-300 ${
                    pt.scheduledCount === 0
                      ? 'bg-slate-200'
                      : pt.completionPercentage === 100
                      ? 'bg-emerald-500'
                      : pt.completionPercentage > 0
                      ? 'bg-indigo-500'
                      : 'bg-rose-300'
                  }`}
                />
              </div>
              <span className="text-[9px] text-slate-400 font-medium">{pt.date.slice(8)}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Category Breakdown + 7-Day Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-5 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
          <h2 className="text-base font-bold text-slate-900 mb-1">Focus Area Consistency</h2>
          <p className="text-xs text-slate-500 mb-6">
            7-day scheduled completion rate by category
          </p>

          <div className="space-y-5 tabular-nums">
            {categoryStats.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-semibold text-slate-800">{cat.category}</span>
                  <span className="text-slate-500">
                    {cat.completedLogs} check-ins {"\u2022"}{' '}
                    <strong className="text-slate-900">{cat.pct}%</strong>
                  </span>
                </div>
                <div className="w-full h-2 rounded-full bg-slate-100 overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(cat.pct, 4)}%` }}
                    transition={{ duration: 0.4 }}
                    className={`h-full rounded-full ${
                      cat.category === 'DSA'
                        ? 'bg-indigo-600'
                        : cat.category === 'Full-Stack'
                        ? 'bg-violet-600'
                        : cat.category === 'Cybersecurity'
                        ? 'bg-emerald-600'
                        : 'bg-amber-500'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        <div className="xl:col-span-7 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 overflow-x-auto shadow-xs">
          <div className="flex flex-wrap items-center justify-between gap-2 mb-5">
            <div>
              <h2 className="text-base font-bold text-slate-900">7-Day Habit Schedule Matrix</h2>
              <p className="text-xs text-slate-500">
                Completed {"\u2022"} Pending Today {"\u2022"} Planned Rest Day (-)
              </p>
            </div>
            <span className="text-xs font-medium px-2.5 py-1 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1.5">
              <ShieldCheck className="w-3.5 h-3.5" /> Same-Day Verified
            </span>
          </div>

          {habits.length === 0 ? (
            <p className="text-xs text-slate-500 py-10 text-center">
              Create your first habit on the Dashboard to view your 7-day schedule matrix.
            </p>
          ) : (
            <table className="w-full text-left border-collapse tabular-nums">
              <thead>
                <tr className="border-b border-slate-200 text-[11px] text-slate-500">
                  <th className="pb-3 font-semibold">Habit & Schedule</th>
                  {dayColumns.map((d) => {
                    const dayShort = new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
                      weekday: 'short',
                      timeZone: 'UTC',
                    });
                    return (
                      <th key={d} className="pb-3 text-center font-semibold">
                        <div>{dayShort}</div>
                        <div className="text-[10px] text-slate-400">{d.slice(8)}</div>
                      </th>
                    );
                  })}
                  <th className="pb-3 text-right font-semibold">Streak / Best</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100 text-xs">
                {habits.map((h) => {
                  const scheduleLabel =
                    !h.scheduledDays || h.scheduledDays.length === 7
                      ? 'Daily'
                      : h.scheduledDays.map((w) => WEEKDAY_LABELS[w]).join(', ');
                  return (
                    <tr key={h.id} className="hover:bg-slate-50/80 transition">
                      <td className="py-3.5 pr-3 font-semibold text-slate-900">
                        <div>{h.title}</div>
                        <span className="text-[11px] text-slate-500 font-normal">
                          {h.category} {"\u2022"} {scheduleLabel}
                        </span>
                      </td>
                      {h.weeklyProgress.map((p, idx) => {
                        const isToday = idx === h.weeklyProgress.length - 1;
                        const isScheduled = p.isScheduled !== false;
                        return (
                          <td key={p.date} className="py-3.5 text-center">
                            <div
                              title={`${p.date}: ${
                                p.completed
                                  ? p.note || 'Completed'
                                  : !isScheduled
                                  ? 'Rest day (streak preserved)'
                                  : 'Not completed'
                              }`}
                              className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[10px] font-bold ${
                                p.completed
                                  ? 'bg-emerald-50 text-emerald-700 border border-emerald-300'
                                  : !isScheduled
                                  ? 'bg-slate-50 text-slate-300'
                                  : isToday
                                  ? 'bg-indigo-50 text-indigo-700 border border-indigo-300'
                                  : 'bg-slate-100 text-slate-400'
                              }`}
                            >
                              {p.completed ? (
                                <Check className="w-3.5 h-3.5 stroke-[2.5]" />
                              ) : !isScheduled ? (
                                '-'
                              ) : isToday ? (
                                'o'
                              ) : (
                                '.'
                              )}
                            </div>
                          </td>
                        );
                      })}
                      <td className="py-3.5 text-right font-bold text-slate-900">
                        {h.currentStreak}d{' '}
                        <span className="text-[11px] text-slate-400 font-normal">
                          / {h.longestStreak ?? h.currentStreak}d
                        </span>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Recent Verification Notes */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-base font-bold text-slate-900">Recent Check-in Notes</h2>
            <p className="text-xs text-slate-500">
              Work summaries and LeetCode verifications from the past 7 days
            </p>
          </div>
          <Clock className="w-4 h-4 text-slate-400" />
        </div>

        {verifiedAuditLogs.length === 0 ? (
          <p className="text-xs text-slate-500 py-6 text-center">
            No check-in notes recorded this week yet. Complete a habit on the Dashboard to see your
            progress log here.
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {verifiedAuditLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[11px] font-semibold px-2.5 py-0.5 rounded-md bg-emerald-50 text-emerald-700 border border-emerald-200 flex items-center gap-1 tabular-nums">
                    <CheckCircle2 className="w-3 h-3" /> {log.date}
                  </span>
                  <span className="text-[10.5px] font-semibold text-slate-500 uppercase">
                    {log.category}
                  </span>
                </div>
                <div className="text-sm font-bold text-slate-900">{log.habitTitle}</div>
                <p className="text-xs text-slate-600">"{log.note}"</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}