import type { NewTransactionInput, TransactionStatus } from '@/types/finance';
import { addMonthsToDateKey, monthsBetween, type DateKey } from '@/utils/date';
import { splitInstallments } from '@/utils/money';

export const MAX_INSTALLMENTS = 48;
/** Hard cap so a projection can never produce an unbounded list. */
const MAX_PROJECTED_OCCURRENCES = 120;

export type EntryDraft = {
  sequence: number;
  amountCents: number;
  dueDate: DateKey;
  status: TransactionStatus;
};

/**
 * Rows to materialize for a new transaction.
 * - Installments: one row per installment, each with its own amount and month.
 * - Recurring: only the first occurrence; later ones are projected on demand.
 */
export function buildEntryDrafts(input: NewTransactionInput): EntryDraft[] {
  if (input.recurring) {
    return [{ sequence: 1, amountCents: input.amountCents, dueDate: input.date, status: input.status }];
  }

  return splitInstallments(input.amountCents, input.installmentCount).map((amountCents, index) => ({
    sequence: index + 1,
    amountCents,
    dueDate: addMonthsToDateKey(input.date, index),
    status: input.status,
  }));
}

export type RecurringSeries = {
  startDate: DateKey;
  intervalMonths: number;
  endDate: DateKey | null;
};

/** Occurrences of a monthly series that fall inside [rangeStart, rangeEnd]. */
export function projectRecurringOccurrences(
  series: RecurringSeries,
  rangeStart: DateKey,
  rangeEnd: DateKey,
): { sequence: number; dueDate: DateKey }[] {
  const occurrences: { sequence: number; dueDate: DateKey }[] = [];
  const lastDate = series.endDate !== null && series.endDate < rangeEnd ? series.endDate : rangeEnd;
  const firstIndex = Math.max(0, Math.floor(monthsBetween(series.startDate, rangeStart) / series.intervalMonths) - 1);

  for (let index = firstIndex; occurrences.length < MAX_PROJECTED_OCCURRENCES; index += 1) {
    const dueDate = addMonthsToDateKey(series.startDate, index * series.intervalMonths);
    if (dueDate > lastDate) break;
    if (dueDate >= rangeStart) occurrences.push({ sequence: index + 1, dueDate });
  }

  return occurrences;
}
