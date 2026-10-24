export interface DailyProgress {
  date: string;
  isScheduled?: boolean;
  completed: boolean;
  note: string | null;
  verifiedCount: number;
}

export interface Habit {
  id: string;
  title: string;
  category: string;
  targetDaysPerWeek: number;
  scheduledDays: number[];
  verificationType: 'MANUAL_PROOF' | 'LEETCODE';
  leetcodeUsername: string | null;
  dailyTargetCount: number;
  isArchived?: boolean;
  createdAt: string;
  isScheduledToday?: boolean;
  completedToday: boolean;
  todayNote: string | null;
  todayVerifiedCount: number;
  currentStreak: number;
  longestStreak: number;
  weeklyProgress: DailyProgress[];
}

export interface DailyTrendPoint {
  date: string;
  scheduledCount: number;
  completedCount: number;
  completionPercentage: number;
}

export interface UserHabitAnalytics {
  todayStr: string;
  todayScheduledCount: number;
  todayCompletedCount: number;
  todayCompletionPercentage: number;
  weeklyScheduledCount: number;
  weeklyCompletedCount: number;
  weeklyCompletionPercentage: number;
  thirtyDayScheduledCount: number;
  thirtyDayCompletedCount: number;
  thirtyDayCompletionPercentage: number;
  currentStreak: number;
  longestStreak: number;
  totalCompletedScheduledHabits: number;
  trend7Days: DailyTrendPoint[];
  trend30Days: DailyTrendPoint[];
}

export type CalendarDayStatus =
  | 'completed'
  | 'partial'
  | 'pending_today'
  | 'missed'
  | 'unscheduled'
  | 'future'
  | 'before_created';

export interface CalendarDayCell {
  date: string;
  weekday: number;
  status: CalendarDayStatus;
  scheduledCount: number;
  completedCount: number;
  completedHabitTitles: string[];
  notes: string[];
}

export interface MonthlyCalendarResponse {
  month: string;
  todayStr: string;
  habitId: string | null;
  totalHabitsIncluded: number;
  summary: {
    completedDays: number;
    partialDays: number;
    missedDays: number;
    unscheduledDays: number;
    totalCompletedLogsInMonth: number;
  };
  days: CalendarDayCell[];
}

export interface CreateHabitPayload {
  title: string;
  category: string;
  targetDaysPerWeek: number;
  scheduledDays?: number[];
  verificationType: 'MANUAL_PROOF' | 'LEETCODE';
  leetcodeUsername?: string;
  dailyTargetCount?: number;
}

export interface UpdateHabitPayload {
  title?: string;
  category?: string;
  scheduledDays?: number[];
  dailyTargetCount?: number;
  leetcodeUsername?: string;
  isArchived?: boolean;
}