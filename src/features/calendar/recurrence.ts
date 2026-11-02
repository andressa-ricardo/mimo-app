import type { Recurrence } from '@/types/calendar';
import { addDaysToDateKey, addMonthsToDateKey, daysBetween, monthsBetween, type DateKey } from '@/utils/date';

/** Hard cap per series and range, so a projection can never run away. */
const MAX_OCCURRENCES = 400;

export type RecurringSource = {
  startDate: DateKey;
  endDate: DateKey;
  recurrence: Recurrence;
  recurrenceUntil: DateKey | null;
  exceptions: readonly DateKey[];
};

export type Occurrence = { startDate: DateKey; endDate: DateKey };

/** Start date of occurrence `index` (0 = the original). Monthly keeps the day, clamped to short months. */
export function occurrenceStart(startDate: DateKey, recurrence: Recurrence, index: number): DateKey {
  if (recurrence === 'daily') return addDaysToDateKey(startDate, index);
  if (recurrence === 'weekly') return addDaysToDateKey(startDate, index * 7);
  if (recurrence === 'monthly') return addMonthsToDateKey(startDate, index);
  return startDate;
}

/** A safe first index to scan from, so long-running series do not iterate from the start. */
function firstIndexNear(source: RecurringSource, rangeStart: DateKey, durationDays: number): number {
  const target = addDaysToDateKey(rangeStart, -durationDays);
  if (target <= source.startDate) return 0;
  if (source.recurrence === 'daily') return daysBetween(source.startDate, target);
  if (source.recurrence === 'weekly') return Math.floor(daysBetween(source.startDate, target) / 7);
  if (source.recurrence === 'monthly') return Math.max(0, monthsBetween(source.startDate, target) - 1);
  return 0;
}

/**
 * Occurrences that overlap [rangeStart, rangeEnd], computed on demand —
 * recurring appointments are never stored as one row per occurrence.
 */
export function expandOccurrences(source: RecurringSource, rangeStart: DateKey, rangeEnd: DateKey): Occurrence[] {
  const durationDays = daysBetween(source.startDate, source.endDate);
  const skipped = new Set(source.exceptions);

  if (source.recurrence === 'none') {
    const overlaps = source.startDate <= rangeEnd && source.endDate >= rangeStart;
    return overlaps && !skipped.has(source.startDate) ? [{ startDate: source.startDate, endDate: source.endDate }] : [];
  }

  const occurrences: Occurrence[] = [];
  for (let index = firstIndexNear(source, rangeStart, durationDays); occurrences.length < MAX_OCCURRENCES; index += 1) {
    const startDate = occurrenceStart(source.startDate, source.recurrence, index);
    if (startDate > rangeEnd) break;
    if (source.recurrenceUntil !== null && startDate > source.recurrenceUntil) break;
    const endDate = addDaysToDateKey(startDate, durationDays);
    if (endDate >= rangeStart && !skipped.has(startDate)) occurrences.push({ startDate, endDate });
  }
  return occurrences;
}

export const recurrenceLabels: Record<Recurrence, string> = {
  none: 'Não se repete',
  daily: 'Todos os dias',
  weekly: 'Toda semana',
  monthly: 'Todo mês',
};
