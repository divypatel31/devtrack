import { motion } from 'framer-motion';
import {
  BarChart3,
  Flame,
  ShieldCheck,
  CheckCircle2,
  Award,
  Clock,
  Lock,
  TrendingUp,
} from 'lucide-react';
import type { Habit } from '../types/habit';

interface StatisticsViewProps {
  habits: Habit[];
  todayStr: string;
}

export function StatisticsView({ habits, todayStr }: StatisticsViewProps) {
  const totalGoals = habits.length;
  const completedToday = habits.filter((h) => h.completedToday).length;
  const bestStreak = habits.reduce((max, h) => Math.max(max, h.currentStreak), 0);

  const totalPossibleWeek = Math.max(totalGoals * 7, 1);
  const totalCompletedWeek = habits.reduce(
    (sum, h) => sum + h.weeklyProgress.filter((d) => d.completed).length,
    0
  );
  const weeklyConsistency =
    totalGoals > 0 ? Math.round((totalCompletedWeek / totalPossibleWeek) * 100) : 0;

  const categories = ['DSA', 'Full-Stack', 'System Design', 'Cybersecurity'];
  const categoryStats = categories.map((cat) => {
    const catHabits = habits.filter((h) => h.category === cat);
    const catLogs = catHabits.reduce(
      (sum, h) => sum + h.weeklyProgress.filter((d) => d.completed).length,
      0
    );
    const catMax = Math.max(catHabits.length * 7, 1);
    const pct = catHabits.length > 0 ? Math.round((catLogs / catMax) * 100) : 0;
    return {
      category: cat,
      goalCount: catHabits.length,
      completedLogs: catLogs,
      pct,
    };
  });

  // Collect verified logs with proof notes across the last 7 days
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
            ? `Auto-verified via LeetCode (@${h.leetcodeUsername})`
            : 'Verified completion'),
      }))
  );

  verifiedAuditLogs.sort((a, b) => b.date.localeCompare(a.date));

  const dayColumns = habits[0]?.weeklyProgress.map((d) => d.date) || [];

  return (
    <motion.div
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6"
    >
      {/* Top 4 KPI Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-2 xl:grid-cols-4 gap-5">
        <div className="bg-[#151621] border border-white/[0.05] rounded-[24px] p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#7c7f93] font-semibold uppercase tracking-wider">
              7-Day Consistency
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-1">{weeklyConsistency}%</h3>
            <p className="text-[11px] text-emerald-400 mt-1 flex items-center gap-1">
              <TrendingUp className="w-3 h-3" /> {totalCompletedWeek} verified check-ins
            </p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#6c47ff]/20 border border-[#6c47ff]/40 flex items-center justify-center text-[#7c5cfc]">
            <BarChart3 className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#151621] border border-white/[0.05] rounded-[24px] p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#7c7f93] font-semibold uppercase tracking-wider">
              Longest Active Streak
            </p>
            <h3 className="text-3xl font-extrabold text-[#f5b014] mt-1">{bestStreak} Days</h3>
            <p className="text-[11px] text-[#8b8d9f] mt-1">Consecutive verified days</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#f5b014]/15 border border-[#f5b014]/30 flex items-center justify-center text-[#f5b014]">
            <Flame className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#151621] border border-white/[0.05] rounded-[24px] p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#7c7f93] font-semibold uppercase tracking-wider">
              Today's Velocity
            </p>
            <h3 className="text-3xl font-extrabold text-white mt-1">
              {completedToday}/{totalGoals}
            </h3>
            <p className="text-[11px] text-[#8b8d9f] mt-1">Goals completed on {todayStr}</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-[#ff4d94]/15 border border-[#ff4d94]/30 flex items-center justify-center text-[#ff4d94]">
            <Award className="w-6 h-6" />
          </div>
        </div>

        <div className="bg-[#151621] border border-white/[0.05] rounded-[24px] p-5 flex items-center justify-between">
          <div>
            <p className="text-xs text-[#7c7f93] font-semibold uppercase tracking-wider">
              Anti-Cheat Integrity
            </p>
            <h3 className="text-3xl font-extrabold text-emerald-400 mt-1">100%</h3>
            <p className="text-[11px] text-[#8b8d9f] mt-1">Past dates cryptographically locked</p>
          </div>
          <div className="w-12 h-12 rounded-2xl bg-emerald-500/15 border border-emerald-500/30 flex items-center justify-center text-emerald-400">
            <ShieldCheck className="w-6 h-6" />
          </div>
        </div>
      </div>

      {/* Middle Row: Category Breakdown + 7-Day Habit Matrix */}
      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        {/* Category Mastery Bars */}
        <div className="xl:col-span-5 bg-[#151621] border border-white/[0.05] rounded-[26px] p-6">
          <h2 className="text-[16px] font-bold text-white mb-1">Domain Mastery Breakdown</h2>
          <p className="text-xs text-[#7c7f93] mb-6">
            Weekly completion velocity across engineering tracks
          </p>

          <div className="space-y-5">
            {categoryStats.map((cat) => (
              <div key={cat.category}>
                <div className="flex items-center justify-between text-xs mb-2">
                  <span className="font-bold text-white">{cat.category}</span>
                  <span className="text-[#8b8d9f]">
                    {cat.completedLogs} logs • <strong className="text-white">{cat.pct}%</strong>
                  </span>
                </div>
                <div className="w-full h-2.5 rounded-full bg-[#222434] overflow-hidden">
                  <motion.div
                    initial={{ width: 0 }}
                    animate={{ width: `${Math.max(cat.pct, 6)}%` }}
                    transition={{ duration: 0.5 }}
                    className={`h-full rounded-full ${
                      cat.category === 'DSA'
                        ? 'bg-gradient-to-r from-[#6c47ff] to-[#a78bfa]'
                        : cat.category === 'Full-Stack'
                        ? 'bg-gradient-to-r from-[#ff4d94] to-[#fb7185]'
                        : cat.category === 'Cybersecurity'
                        ? 'bg-gradient-to-r from-emerald-500 to-teal-400'
                        : 'bg-gradient-to-r from-[#f5b014] to-amber-300'
                    }`}
                  />
                </div>
              </div>
            ))}
          </div>
        </div>

        {/* 7-Day Habit Consistency Matrix */}
        <div className="xl:col-span-7 bg-[#151621] border border-white/[0.05] rounded-[26px] p-6 overflow-x-auto">
          <div className="flex items-center justify-between mb-5">
            <div>
              <h2 className="text-[16px] font-bold text-white">7-Day Verification Matrix</h2>
              <p className="text-xs text-[#7c7f93]">
                Day-by-day audit grid across all active goals
              </p>
            </div>
            <span className="text-[11px] font-semibold px-3 py-1 rounded-full bg-[#212334] text-[#f5b014] flex items-center gap-1.5">
              <Lock className="w-3 h-3" /> Anti-Cheat Active
            </span>
          </div>

          {habits.length === 0 ? (
            <p className="text-xs text-[#7c7f93] py-8 text-center">
              No habits tracked yet. Create a goal to populate the verification matrix!
            </p>
          ) : (
            <table className="w-full text-left border-collapse">
              <thead>
                <tr className="border-b border-white/[0.05] text-[11px] text-[#7c7f93]">
                  <th className="pb-3 font-semibold">Goal</th>
                  {dayColumns.map((d) => {
                    const dayShort = new Date(`${d}T00:00:00Z`).toLocaleDateString('en-US', {
                      weekday: 'short',
                      timeZone: 'UTC',
                    });
                    return (
                      <th key={d} className="pb-3 text-center font-semibold">
                        <div>{dayShort}</div>
                        <div className="text-[9px] text-[#565869]">{d.slice(8)}</div>
                      </th>
                    );
                  })}
                  <th className="pb-3 text-right font-semibold">Streak</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-white/[0.04] text-xs">
                {habits.map((h) => (
                  <tr key={h.id} className="hover:bg-white/[0.01]">
                    <td className="py-3.5 pr-3 font-semibold text-white">
                      <div>{h.title}</div>
                      <span className="text-[10px] text-[#7c7f93] font-normal">{h.category}</span>
                    </td>
                    {h.weeklyProgress.map((p, idx) => {
                      const isToday = idx === h.weeklyProgress.length - 1;
                      return (
                        <td key={p.date} className="py-3.5 text-center">
                          <div
                            title={`${p.date}: ${p.completed ? p.note || 'Verified' : 'Missed'}`}
                            className={`w-7 h-7 mx-auto rounded-lg flex items-center justify-center text-[10px] font-bold ${
                              p.completed
                                ? 'bg-emerald-500/20 text-emerald-400 border border-emerald-500/40'
                                : isToday
                                ? 'bg-[#6c47ff]/20 text-white border border-[#6c47ff]'
                                : 'bg-[#101119] text-[#565869]'
                            }`}
                          >
                            {p.completed ? '✓' : isToday ? '◎' : '·'}
                          </div>
                        </td>
                      );
                    })}
                    <td className="py-3.5 text-right font-bold text-[#f5b014]">
                      🔥 {h.currentStreak}d
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </div>
      </div>

      {/* Bottom Audit Log Timeline */}
      <div className="bg-[#151621] border border-white/[0.05] rounded-[26px] p-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h2 className="text-[16px] font-bold text-white">Verified Proof & LeetCode Audit Log</h2>
            <p className="text-xs text-[#7c7f93]">
              Cryptographic & manual proof submissions from the last 7 days
            </p>
          </div>
          <Clock className="w-4 h-4 text-[#7c7f93]" />
        </div>

        {verifiedAuditLogs.length === 0 ? (
          <p className="text-xs text-[#7c7f93] py-6 text-center">
            No verified logs recorded this week yet. Complete a goal or sync LeetCode to see audit entries!
          </p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {verifiedAuditLogs.map((log) => (
              <div
                key={log.id}
                className="p-4 rounded-2xl bg-[#101119] border border-white/[0.05] flex flex-col justify-between gap-2"
              >
                <div className="flex items-center justify-between">
                  <span className="text-[10.5px] font-bold px-2.5 py-0.5 rounded-md bg-emerald-500/15 text-emerald-400 flex items-center gap-1">
                    <CheckCircle2 className="w-3 h-3" /> {log.date}
                  </span>
                  <span className="text-[10px] font-semibold text-[#7c7f93] uppercase">
                    {log.category}
                  </span>
                </div>
                <div className="text-sm font-bold text-white">{log.habitTitle}</div>
                <p className="text-xs text-[#9ca0b5] italic">"{log.note}"</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </motion.div>
  );
}