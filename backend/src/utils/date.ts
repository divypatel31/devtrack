const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

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

export function formatDateStr(date: Date): string {
  return date.toISOString().split('T')[0];
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