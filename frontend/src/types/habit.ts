export interface DailyProgress {
  date: string; // YYYY-MM-DD
  completed: boolean;
}

export interface Habit {
  id: string;
  title: string;
  category: string;
  targetDaysPerWeek: number;
  createdAt: string;
  completedToday: boolean;
  currentStreak: number;
  weeklyProgress: DailyProgress[];
}

export interface CreateHabitPayload {
  title: string;
  category: string;
  targetDaysPerWeek: number;
}