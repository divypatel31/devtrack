import type { Habit } from '../types/habit';

interface HabitCardProps {
  habit: Habit;
  togglingDate: string | null;
  onToggleDate: (habitId: string, date: string) => void;
  onDelete: (habitId: string) => void;
}

function getDayInitial(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { weekday: 'narrow', timeZone: 'UTC' });
}

export function HabitCard({
  habit,
  togglingDate,
  onToggleDate,
  onDelete,
}: HabitCardProps) {
  const todayEntry = habit.weeklyProgress[habit.weeklyProgress.length - 1];
  const todayDateStr = todayEntry?.date || '';
  const isTogglingToday = togglingDate === `${habit.id}:${todayDateStr}`;

  return (
    <article className={`habit-card ${habit.completedToday ? 'habit-card-done' : ''}`}>
      <div className="habit-card-top">
        <div className="habit-info">
          <div className="habit-badges">
            <span className="category-tag">{habit.category}</span>
            <span className={`streak-tag ${habit.currentStreak > 0 ? 'streak-active' : ''}`}>
              🔥 {habit.currentStreak}d streak
            </span>
          </div>
          <h3 className="habit-title">{habit.title}</h3>
        </div>

        <div className="habit-actions">
          <button
            type="button"
            className={`check-btn ${habit.completedToday ? 'check-btn-active' : ''}`}
            disabled={isTogglingToday}
            onClick={() => onToggleDate(habit.id, todayDateStr)}
            aria-label={habit.completedToday ? 'Mark incomplete' : 'Mark complete'}
          >
            {isTogglingToday ? '•••' : habit.completedToday ? '✓' : '+'}
          </button>
        </div>
      </div>

      <div className="habit-week-row">
        <div className="mini-days">
          {habit.weeklyProgress.map((day, idx) => {
            const isBusy = togglingDate === `${habit.id}:${day.date}`;
            const isToday = idx === habit.weeklyProgress.length - 1;
            return (
              <button
                key={day.date}
                type="button"
                disabled={isBusy}
                onClick={() => onToggleDate(habit.id, day.date)}
                title={`Toggle ${day.date}`}
                className={`mini-day-pill ${day.completed ? 'mini-day-done' : ''} ${
                  isToday ? 'mini-day-today' : ''
                }`}
              >
                <span className="mini-day-letter">{getDayInitial(day.date)}</span>
                <span className="mini-day-dot">{day.completed ? '●' : '○'}</span>
              </button>
            );
          })}
        </div>

        <button
          type="button"
          className="delete-btn"
          onClick={() => onDelete(habit.id)}
          title="Delete habit"
        >
          Delete
        </button>
      </div>
    </article>
  );
}