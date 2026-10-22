const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;
const MONTH_REGEX = /^\d{4}-\d{2}$/;

export const ALL_WEEKDAYS = [0, 1, 2, 3, 4, 5, 6] as const;

/**
 * Validates that a string is strictly YYYY-MM-DD and represents a real calendar date
 * (e.g. rejects 2026-02-31 or 2026-99-99).
 */
export function isValidCalendarDate(dateStr: unknown): dateStr is string {
  if (typeof dateStr !== 'string' || !DATE_REGEX.test(dateStr)) {
    return false;
  }
  const parsed = new Date(`${dateStr}T00:00:00.000Z`);
  if (Number.isNaN(parsed.getTime())) {
    return false;
  }
  return parsed.toISOString().split('T')[0] === dateStr;
}

/**
 * Validates that a string is strictly YYYY-MM with month between 01 and 12.
 */
export function isValidYearMonth(monthStr: unknown): monthStr is string {
  if (typeof monthStr !== 'string' || !MONTH_REGEX.test(monthStr)) {
    return false;
  }
  const [yearStr, mStr] = monthStr.split('-');
  const year = Number(yearStr);
  const month = Number(mStr);
  return Number.isInteger(year) && year >= 1970 && year <= 2100 && month >= 1 && month <= 12;
}

/**
 * Returns all YYYY-MM-DD dates in a valid YYYY-MM month in chronological order.
 */
export function getDatesInMonth(monthStr: string): string[] {
  if (!isValidYearMonth(monthStr)) {
    throw new Error('Invalid month format. Expected YYYY-MM.');
  }
  const [yearStr, mStr] = monthStr.split('-');
  const year = Number(yearStr);
  const monthIndex = Number(mStr) - 1;
  const daysInMonth = new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate();

  const dates: string[] = [];
  for (let day = 1; day <= daysInMonth; day++) {
    const dayPadded = String(day).padStart(2, '0');
    dates.push(`${monthStr}-${dayPadded}`);
  }
  return dates;
}

export function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
}

/**
 * Validates and normalizes timezone offset in minutes (-720 to +840, i.e. UTC-12 to UTC+14).
 */
export function parseTimezoneOffsetMinutes(offset: unknown, fallback = 0): number {
  if (offset === undefined || offset === null || offset === '') {
    return fallback;
  }
  const num = Number(offset);
  if (!Number.isInteger(num) || num < -720 || num > 840) {
    throw new Error('timezoneOffsetMinutes must be an integer between -720 and 840.');
  }
  return num;
}

/**
 * Computes the local YYYY-MM-DD date string for a given timezone offset in minutes.
 */
export function getTodayForTimezone(
  timezoneOffsetMinutes = 0,
  nowMs: number = Date.now()
): string {
  const localMs = nowMs + timezoneOffsetMinutes * 60 * 1000;
  return formatDateStr(new Date(localMs));
}

/**
 * Returns the day of the week (0 = Sunday .. 6 = Saturday) for a valid YYYY-MM-DD string.
 */
export function getWeekdayIndex(dateStr: string): number {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  return d.getUTCDay();
}

/**
 * Adds (or subtracts) calendar days from a YYYY-MM-DD string safely across month/year boundaries.
 */
export function addCalendarDays(dateStr: string, deltaDays: number): string {
  const d = new Date(`${dateStr}T00:00:00.000Z`);
  d.setUTCDate(d.getUTCDate() + deltaDays);
  return formatDateStr(d);
}

/**
 * Generates an ordered array of YYYY-MM-DD strings ending at endDateStr of length daysCount.
 */
export function getDateRangeEndingAt(endDateStr: string, daysCount: number): string[] {
  const result: string[] = [];
  for (let i = daysCount - 1; i >= 0; i--) {
    result.push(addCalendarDays(endDateStr, -i));
  }
  return result;
}

/**
 * Validates and normalizes a scheduledDays array of weekday integers (0..6).
 */
export function normalizeScheduledDays(input: unknown): number[] {
  if (input === undefined || input === null) {
    return [...ALL_WEEKDAYS];
  }
  if (!Array.isArray(input) || input.length === 0 || input.length > 7) {
    throw new Error('scheduledDays must be a non-empty array of integers between 0 (Sun) and 6 (Sat).');
  }
  const unique = new Set<number>();
  for (const item of input) {
    const n = Number(item);
    if (!Number.isInteger(n) || n < 0 || n > 6) {
      throw new Error('scheduledDays must contain only integers from 0 (Sun) to 6 (Sat).');
    }
    unique.add(n);
  }
  return Array.from(unique).sort((a, b) => a - b);
}

/**
 * Returns the set of valid "today" calendar dates across real-world timezones
 * relative to a reference timestamp (UTC-12 to UTC+14).
 */
export function getAllowedTodayDates(nowMs: number = Date.now()): Set<string> {
  const allowed = new Set<string>();
  const minOffsetMs = -12 * 60 * 60 * 1000;
  const maxOffsetMs = 14 * 60 * 60 * 1000;

  allowed.add(formatDateStr(new Date(nowMs + minOffsetMs)));
  allowed.add(formatDateStr(new Date(nowMs)));
  allowed.add(formatDateStr(new Date(nowMs + maxOffsetMs)));
  return allowed;
}

/**
 * Verifies whether a client-supplied date is a valid current day within global timezone bounds.
 */
export function isWithinAllowedTodayWindow(dateStr: string, nowMs: number = Date.now()): boolean {
  if (!isValidCalendarDate(dateStr)) {
    return false;
  }
  return getAllowedTodayDates(nowMs).has(dateStr);
}