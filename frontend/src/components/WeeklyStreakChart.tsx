import type { Habit } from '../types/habit';

interface WeeklyStreakChartProps {
  habits: Habit[];
}

function getShortDayName(dateStr: string): string {
  const date = new Date(`${dateStr}T00:00:00Z`);
  return date.toLocaleDateString('en-US', { weekday: 'short', timeZone: 'UTC' });
}

function getDayNumber(dateStr: string): string {
  return dateStr.split('-')[2];
}

export function WeeklyStreakChart({ habits }: WeeklyStreakChartProps) {
  if (habits.length === 0) {
    return null;
  }

  const totalHabits = habits.length;
  const days = habits[0].weeklyProgress.map((d) => d.date);

  const dailyStats = days.map((date, idx) => {
    const completedCount = habits.reduce((acc, habit) => {
      const dayEntry = habit.weeklyProgress.find((p) => p.date === date);
      return acc + (dayEntry?.completed ? 1 : 0);
    }, 0);

    const percentage = Math.round((completedCount / totalHabits) * 100);
    const isToday = idx === days.length - 1;

    return {
      date,
      dayName: getShortDayName(date),
      dayNum: getDayNumber(date),
      completedCount,
      percentage,
      isToday,
    };
  });

  const weeklyTotalCompleted = dailyStats.reduce((sum, d) => sum + d.completedCount, 0);
  const weeklyMaxPossible = totalHabits * 7;
  const weeklyConsistency = Math.round((weeklyTotalCompleted / weeklyMaxPossible) * 100);

  return (
    <section className="card">
      <div className="chart-header">
        <div>
          <h2 className="card-title" style={{ marginBottom: '0.15rem' }}>
            Weekly Streak Chart
          </h2>
          <p className="chart-subtitle">Last 7 days consistency across {totalHabits} goals</p>
        </div>
        <div className="consistency-pill">{weeklyConsistency}% wk</div>
      </div>

      <div className="bar-chart-grid">
        {dailyStats.map((stat) => (
          <div
            key={stat.date}
            className={`bar-column ${stat.isToday ? 'bar-column-today' : ''}`}
          >
            <span className="bar-count">
              {stat.completedCount}/{totalHabits}
            </span>
            <div className="bar-track">
              <div
                className={`bar-fill ${
                  stat.percentage === 100
                    ? 'bar-fill-complete'
                    : stat.percentage > 0
                    ? 'bar-fill-partial'
                    : ''
                }`}
                style={{ height: `${Math.max(stat.percentage, 8)}%` }}
              />
            </div>
            <span className="bar-day-name">{stat.dayName}</span>
            <span className="bar-day-num">{stat.dayNum}</span>
          </div>
        ))}
      </div>
    </section>
  );
}