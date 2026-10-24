import { useEffect, useState } from 'react';
import {
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  Check,
  Clock,
  XCircle,
  Minus,
  AlertCircle,
  RefreshCw,
  Sparkles,
} from 'lucide-react';
import { fetchMonthlyCalendar } from '../api/habits';
import type { Habit, MonthlyCalendarResponse, CalendarDayCell } from '../types/habit';

interface HabitCalendarViewProps {
  habits: Habit[];
  todayStr: string;
}

const WEEKDAY_HEADERS = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

function shiftYearMonth(monthStr: string, deltaMonths: number): string {
  const [yStr, mStr] = monthStr.split('-');
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1 + deltaMonths, 1));
  const year = d.getUTCFullYear();
  const month = String(d.getUTCMonth() + 1).padStart(2, '0');
  return `${year}-${month}`;
}

function formatMonthHeading(monthStr: string): string {
  const [yStr, mStr] = monthStr.split('-');
  const d = new Date(Date.UTC(Number(yStr), Number(mStr) - 1, 1));
  return d.toLocaleDateString('en-US', {
    month: 'long',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function HabitCalendarView({ habits, todayStr }: HabitCalendarViewProps) {
  const currentMonth = todayStr.slice(0, 7);
  const [selectedMonth, setSelectedMonth] = useState<string>(currentMonth);
  const [selectedHabitId, setSelectedHabitId] = useState<string>('');
  const [calendarData, setCalendarData] = useState<MonthlyCalendarResponse | null>(null);
  const [selectedDay, setSelectedDay] = useState<CalendarDayCell | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [error, setError] = useState<string | null>(null);
  const [reloadTick, setReloadTick] = useState<number>(0);

  useEffect(() => {
    let isCancelled = false;

    async function loadMonth() {
      setLoading(true);
      setError(null);
      try {
        const res = await fetchMonthlyCalendar(
          selectedMonth,
          todayStr,
          selectedHabitId || undefined
        );
        if (!isCancelled) {
          setCalendarData(res);
          const defaultSelection =
            res.days.find((d) => d.date === todayStr) ||
            res.days.find((d) => d.completedCount > 0) ||
            res.days[0] ||
            null;
          setSelectedDay(defaultSelection);
        }
      } catch (err) {
        if (!isCancelled) {
          setError(err instanceof Error ? err.message : 'Unable to load monthly calendar');
        }
      } finally {
        if (!isCancelled) {
          setLoading(false);
        }
      }
    }

    void loadMonth();

    return () => {
      isCancelled = true;
    };
  }, [selectedMonth, selectedHabitId, todayStr, reloadTick]);

  const firstDayOffset = calendarData?.days[0]?.weekday ?? 0;
  const leadingBlanks = Array.from({ length: firstDayOffset }, (_, i) => i);

  return (
    <div className="space-y-6">
      {/* Top Controls & Monthly Summary Bar */}
      <div className="bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-wrap items-center justify-between gap-4 shadow-xs">
        <div className="flex items-center gap-3.5">
          <div className="w-11 h-11 rounded-xl bg-indigo-50 border border-indigo-100 flex items-center justify-center text-indigo-600 shrink-0">
            <CalendarIcon className="w-5 h-5" />
          </div>
          <div>
            <h2 className="text-base sm:text-lg font-bold text-slate-900">
              Consistency Calendar
            </h2>
            <p className="text-xs sm:text-sm text-slate-500">
              Review completed days, scheduled sessions, and planned rest days across any month
            </p>
          </div>
        </div>

        <div className="flex flex-wrap items-center gap-2.5">
          <label className="sr-only" htmlFor="calendar-habit-filter">
            Filter calendar by habit
          </label>
          <select
            id="calendar-habit-filter"
            value={selectedHabitId}
            onChange={(e) => setSelectedHabitId(e.target.value)}
            className="bg-slate-50 hover:bg-slate-100/80 border border-slate-200 rounded-xl px-3.5 py-2 text-xs font-medium text-slate-700 transition cursor-pointer"
          >
            <option value="">
              All active habits ({habits.filter((h) => !h.isArchived).length})
            </option>
            {habits.map((h) => (
              <option key={h.id} value={h.id}>
                {h.title} {h.isArchived ? '(Archived)' : ''}
              </option>
            ))}
          </select>

          <div className="flex items-center gap-1 bg-slate-50 border border-slate-200 rounded-xl p-1">
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftYearMonth(m, -1))}
              aria-label="Previous month"
              className="w-8 h-8 rounded-lg hover:bg-white hover:shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <span className="px-3 text-xs font-semibold text-slate-900 min-w-[128px] text-center tabular-nums">
              {formatMonthHeading(selectedMonth)}
            </span>
            <button
              type="button"
              onClick={() => setSelectedMonth((m) => shiftYearMonth(m, 1))}
              aria-label="Next month"
              className="w-8 h-8 rounded-lg hover:bg-white hover:shadow-2xs flex items-center justify-center text-slate-600 hover:text-slate-900 transition cursor-pointer"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>

          {selectedMonth !== currentMonth && (
            <button
              type="button"
              onClick={() => setSelectedMonth(currentMonth)}
              className="text-xs font-semibold px-3.5 py-2 rounded-xl bg-indigo-50 text-indigo-700 border border-indigo-200/80 hover:bg-indigo-600 hover:text-white transition cursor-pointer"
            >
              Jump to Today
            </button>
          )}
        </div>
      </div>

      {error && (
        <div
          role="alert"
          className="p-4 rounded-xl bg-rose-50 border border-rose-200 text-rose-800 text-xs sm:text-sm flex items-center justify-between gap-3"
        >
          <div className="flex items-center gap-2.5">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{error}</span>
          </div>
          <button
            type="button"
            onClick={() => setReloadTick((t) => t + 1)}
            className="px-3 py-1.5 rounded-lg bg-white border border-rose-200 hover:bg-rose-100 text-rose-700 font-semibold flex items-center gap-1.5 cursor-pointer"
          >
            <RefreshCw className="w-3.5 h-3.5" /> Try again
          </button>
        </div>
      )}

      <div className="grid grid-cols-1 xl:grid-cols-12 gap-6">
        <div className="xl:col-span-8 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 shadow-xs">
          {/* Status Legend */}
          <div className="flex flex-wrap items-center justify-between gap-3 mb-5 pb-4 border-b border-slate-100 text-xs text-slate-600">
            <div className="flex flex-wrap items-center gap-4">
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-emerald-50 border border-emerald-400" />
                <span>Completed ({calendarData?.summary.completedDays ?? 0})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-amber-50 border border-amber-400" />
                <span>Partial ({calendarData?.summary.partialDays ?? 0})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-rose-50 border border-rose-300" />
                <span>Missed ({calendarData?.summary.missedDays ?? 0})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-slate-100 border border-slate-300" />
                <span>Rest Day ({calendarData?.summary.unscheduledDays ?? 0})</span>
              </span>
              <span className="flex items-center gap-1.5">
                <span className="w-3 h-3 rounded-xs bg-slate-50 border border-dashed border-slate-300" />
                <span>Upcoming / Unscheduled</span>
              </span>
            </div>
          </div>

          {loading ? (
            <div className="grid grid-cols-7 gap-2 py-4" aria-busy="true">
              {Array.from({ length: 35 }).map((_, idx) => (
                <div
                  key={idx}
                  className="h-16 sm:h-20 rounded-xl bg-slate-100 animate-pulse border border-slate-200/60"
                />
              ))}
            </div>
          ) : habits.length === 0 ? (
            <div className="py-14 px-4 text-center">
              <div className="w-12 h-12 rounded-2xl bg-indigo-50 border border-indigo-100 text-indigo-600 flex items-center justify-center mx-auto mb-3">
                <Sparkles className="w-5 h-5" />
              </div>
              <p className="text-sm font-bold text-slate-900">Your calendar is ready</p>
              <p className="text-xs text-slate-500 mt-1 max-w-sm mx-auto">
                Start with one small habit on the Dashboard. As you check in each day, your
                monthly consistency history will appear here.
              </p>
            </div>
          ) : (
            <>
              <div className="grid grid-cols-7 gap-1.5 sm:gap-2 mb-2 text-center">
                {WEEKDAY_HEADERS.map((day) => (
                  <div
                    key={day}
                    className="text-[11px] font-semibold uppercase tracking-wider text-slate-400 py-1"
                  >
                    {day}
                  </div>
                ))}
              </div>

              <div className="grid grid-cols-7 gap-1.5 sm:gap-2">
                {leadingBlanks.map((b) => (
                  <div key={`blank-${b}`} className="h-16 sm:h-20 rounded-xl bg-transparent" />
                ))}

                {calendarData?.days.map((cell) => {
                  const dayNum = Number(cell.date.slice(8));
                  const isToday = cell.date === todayStr;
                  const isSelected = selectedDay?.date === cell.date;

                  let cellStyle =
                    'bg-slate-50/60 border-slate-200/60 text-slate-400 hover:border-slate-300';
                  if (cell.status === 'completed') {
                    cellStyle =
                      'bg-emerald-50/70 border-emerald-200 text-emerald-900 hover:bg-emerald-50';
                  } else if (cell.status === 'partial') {
                    cellStyle =
                      'bg-amber-50/80 border-amber-200 text-amber-900 hover:bg-amber-50';
                  } else if (cell.status === 'pending_today') {
                    cellStyle =
                      'bg-indigo-50/70 border-indigo-300 text-indigo-950 hover:bg-indigo-50';
                  } else if (cell.status === 'missed') {
                    cellStyle =
                      'bg-rose-50/60 border-rose-200 text-rose-900 hover:bg-rose-50';
                  } else if (cell.status === 'unscheduled') {
                    cellStyle =
                      'bg-slate-100/70 border-slate-200/80 text-slate-500 hover:border-slate-300';
                  }

                  return (
                    <button
                      key={cell.date}
                      type="button"
                      onClick={() => setSelectedDay(cell)}
                      aria-label={`${cell.date}: ${cell.status.replace('_', ' ')}, ${cell.completedCount} of ${cell.scheduledCount} completed`}
                      className={`h-16 sm:h-20 rounded-xl p-2 border flex flex-col justify-between text-left transition cursor-pointer tabular-nums ${cellStyle} ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 ring-offset-1 ring-offset-white'
                          : ''
                      }`}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span
                          className={`text-xs font-bold ${
                            isToday ? 'text-indigo-600' : ''
                          }`}
                        >
                          {dayNum}
                        </span>
                        {isToday && (
                          <span className="text-[9px] font-bold px-1.5 py-0.5 rounded-md bg-indigo-600 text-white">
                            Today
                          </span>
                        )}
                      </div>

                      <div className="flex items-center justify-between w-full text-[10px] font-semibold">
                        {cell.status === 'completed' && (
                          <>
                            <span>
                              {cell.completedCount}/
                              {Math.max(cell.scheduledCount, cell.completedCount)}
                            </span>
                            <Check className="w-3.5 h-3.5 text-emerald-600 stroke-[2.5]" />
                          </>
                        )}
                        {cell.status === 'partial' && (
                          <>
                            <span>
                              {cell.completedCount}/{cell.scheduledCount}
                            </span>
                            <Clock className="w-3 h-3 text-amber-600" />
                          </>
                        )}
                        {cell.status === 'pending_today' && (
                          <>
                            <span>0/{cell.scheduledCount}</span>
                            <Clock className="w-3 h-3 text-indigo-600" />
                          </>
                        )}
                        {cell.status === 'missed' && (
                          <>
                            <span>0/{cell.scheduledCount}</span>
                            <XCircle className="w-3 h-3 text-rose-500" />
                          </>
                        )}
                        {cell.status === 'unscheduled' && (
                          <>
                            <span className="text-slate-400">Rest</span>
                            <Minus className="w-3 h-3 text-slate-400" />
                          </>
                        )}
                        {(cell.status === 'future' || cell.status === 'before_created') && (
                          <span className="text-[9px] text-slate-300">-</span>
                        )}
                      </div>
                    </button>
                  );
                })}
              </div>
            </>
          )}
        </div>

        {/* Selected Date Inspector Panel */}
        <div className="xl:col-span-4 bg-white border border-slate-200/90 rounded-2xl p-5 sm:p-6 flex flex-col justify-between shadow-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <h3 className="text-base font-bold text-slate-900 tabular-nums">
                {selectedDay ? selectedDay.date : 'Select a Date'}
              </h3>
              {selectedDay && (
                <span className="text-[11px] font-semibold uppercase px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-700">
                  {selectedDay.status.replace('_', ' ')}
                </span>
              )}
            </div>
            <p className="text-xs text-slate-500 mb-5">
              Same-day check-in protection keeps your historical streak record accurate.
            </p>

            {selectedDay ? (
              <div className="space-y-4">
                <div className="p-4 rounded-xl bg-slate-50 border border-slate-200/70 space-y-2.5 tabular-nums">
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Scheduled habits</span>
                    <span className="font-semibold text-slate-900">
                      {selectedDay.scheduledCount}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-xs">
                    <span className="text-slate-500">Completed check-ins</span>
                    <span className="font-semibold text-emerald-600">
                      {selectedDay.completedCount}
                    </span>
                  </div>
                </div>

                <div>
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-2.5">
                    Recorded Activity
                  </h4>
                  {selectedDay.notes.length === 0 &&
                  selectedDay.completedHabitTitles.length === 0 ? (
                    <div className="text-xs text-slate-500 p-3.5 rounded-xl bg-slate-50 border border-slate-200/60 leading-relaxed">
                      {selectedDay.status === 'unscheduled'
                        ? 'Planned rest day. Unscheduled days never interrupt your active streak.'
                        : selectedDay.status === 'future'
                        ? 'Upcoming date. You can check in on this day once it arrives.'
                        : selectedDay.status === 'before_created'
                        ? 'No active habits were scheduled on this date.'
                        : 'No completed check-ins were recorded on this date.'}
                    </div>
                  ) : (
                    <div className="space-y-2">
                      {selectedDay.notes.map((n, i) => (
                        <div
                          key={i}
                          className="p-3 rounded-xl bg-emerald-50/70 border border-emerald-200 text-xs text-emerald-950 flex items-start gap-2"
                        >
                          <Check className="w-3.5 h-3.5 text-emerald-600 shrink-0 mt-0.5" />
                          <span>{n}</span>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              </div>
            ) : (
              <p className="text-xs text-slate-500">
                Select any date on the calendar to review its check-in notes.
              </p>
            )}
          </div>

          <div className="mt-6 pt-4 border-t border-slate-100 flex items-center justify-between text-xs text-slate-500 tabular-nums">
            <span>Completed in {selectedMonth}:</span>
            <strong className="text-emerald-600 font-semibold">
              {calendarData?.summary.totalCompletedLogsInMonth ?? 0} check-ins
            </strong>
          </div>
        </div>
      </div>
    </div>
  );
}