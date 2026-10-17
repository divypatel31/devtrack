export interface DailyProgress {
  date: string;
  completed: boolean;
  note: string | null;
  verifiedCount: number;
}

export interface Habit {
  id: string;
  title: string;
  category: string;
  targetDaysPerWeek: number;
  verificationType: 'MANUAL_PROOF' | 'LEETCODE';
  leetcodeUsername: string | null;
  dailyTargetCount: number;
  createdAt: string;
  completedToday: boolean;
  todayNote: string | null;
  todayVerifiedCount: number;
  currentStreak: number;
  weeklyProgress: DailyProgress[];
}

export interface CreateHabitPayload {
  title: string;
  category: string;
  targetDaysPerWeek: number;
  verificationType: 'MANUAL_PROOF' | 'LEETCODE';
  leetcodeUsername?: string;
  dailyTargetCount?: number;
}