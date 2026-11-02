/** Local calendar date stored as `YYYY-MM-DD`. */
export type DateKey = string;
/** Local wall-clock time stored as `HH:MM`. */
export type TimeKey = string;

const DATE_KEY_PATTERN = /^(\d{4})-(\d{2})-(\d{2})$/;
const TIME_KEY_PATTERN = /^([01]\d|2[0-3]):([0-5]\d)$/;

function pad(value: number): string {
  return String(value).padStart(2, '0');
}

export function toDateKey(date: Date): DateKey {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

export function toTimeKey(date: Date): TimeKey {
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`;
}

export function isDateKey(value: string): boolean {
  const match = DATE_KEY_PATTERN.exec(value);
  if (!match) return false;
  const [, year, month, day] = match.map(Number);
  return month >= 1 && month <= 12 && day >= 1 && day <= daysInMonth(year, month - 1);
}

export function isTimeKey(value: string): boolean {
  return TIME_KEY_PATTERN.test(value);
}

function splitDateKey(key: DateKey): [year: number, monthIndex: number, day: number] {
  if (!isDateKey(key)) throw new Error(`Data inválida: ${key}`);
  const [year, month, day] = key.split('-').map(Number);
  return [year, month - 1, day];
}

export function parseDateKey(key: DateKey): Date {
  const [year, monthIndex, day] = splitDateKey(key);
  return new Date(year, monthIndex, day);
}

export function combineDateAndTime(dateKey: DateKey, timeKey: TimeKey): Date {
  const date = parseDateKey(dateKey);
  const [hours, minutes] = timeKey.split(':').map(Number);
  date.setHours(hours, minutes, 0, 0);
  return date;
}

export function daysInMonth(year: number, monthIndex: number): number {
  return new Date(year, monthIndex + 1, 0).getDate();
}

/**
 * Adds calendar months while keeping the original day anchored, clamping to
 * the month's last day (31/01 → 28/02 → 31/03).
 */
export function addMonthsToDateKey(key: DateKey, months: number): DateKey {
  const [year, monthIndex, day] = splitDateKey(key);
  const totalMonths = year * 12 + monthIndex + months;
  const targetYear = Math.floor(totalMonths / 12);
  const targetMonthIndex = totalMonths - targetYear * 12;
  const targetDay = Math.min(day, daysInMonth(targetYear, targetMonthIndex));
  return `${targetYear}-${pad(targetMonthIndex + 1)}-${pad(targetDay)}`;
}

/** Whole calendar months from `from` to `to`, ignoring the day of month. */
export function monthsBetween(from: DateKey, to: DateKey): number {
  const [fromYear, fromMonth] = splitDateKey(from);
  const [toYear, toMonth] = splitDateKey(to);
  return (toYear - fromYear) * 12 + (toMonth - fromMonth);
}

export function getMonthRange(date: Date): { start: DateKey; end: DateKey } {
  const year = date.getFullYear();
  const monthIndex = date.getMonth();
  return {
    start: `${year}-${pad(monthIndex + 1)}-01`,
    end: `${year}-${pad(monthIndex + 1)}-${pad(daysInMonth(year, monthIndex))}`,
  };
}

export function formatDateKey(key: DateKey): string {
  const [year, monthIndex, day] = splitDateKey(key);
  return `${pad(day)}/${pad(monthIndex + 1)}/${year}`;
}

export function nextFullHour(now: Date): TimeKey {
  return `${pad((now.getHours() + 1) % 24)}:00`;
}

// Day arithmetic goes through UTC so DST changes never shift a calendar date.
function dateKeyToUtcDays(key: DateKey): number {
  const [year, monthIndex, day] = splitDateKey(key);
  return Math.round(Date.UTC(year, monthIndex, day) / 86_400_000);
}

export function addDaysToDateKey(key: DateKey, days: number): DateKey {
  const date = new Date((dateKeyToUtcDays(key) + days) * 86_400_000);
  return `${date.getUTCFullYear()}-${pad(date.getUTCMonth() + 1)}-${pad(date.getUTCDate())}`;
}

/** Whole calendar days from `from` to `to` (negative if `to` is earlier). */
export function daysBetween(from: DateKey, to: DateKey): number {
  return dateKeyToUtcDays(to) - dateKeyToUtcDays(from);
}

/** 0 = domingo … 6 = sábado. */
export function weekdayOf(key: DateKey): number {
  const [year, monthIndex, day] = splitDateKey(key);
  return new Date(Date.UTC(year, monthIndex, day)).getUTCDay();
}

/** Sunday on or before the given date (weeks start on Sunday, as in Brazil). */
export function startOfWeek(key: DateKey): DateKey {
  return addDaysToDateKey(key, -weekdayOf(key));
}

/** First day of the month containing `key`. */
export function startOfMonth(key: DateKey): DateKey {
  return `${key.slice(0, 8)}01`;
}

/** Minutes since midnight for an `HH:MM` key. */
export function timeKeyToMinutes(key: TimeKey): number {
  const [hours, minutes] = key.split(':').map(Number);
  return hours * 60 + minutes;
}

export function minutesToTimeKey(totalMinutes: number): TimeKey {
  const clamped = Math.min(Math.max(totalMinutes, 0), 23 * 60 + 59);
  return `${pad(Math.floor(clamped / 60))}:${pad(clamped % 60)}`;
}
