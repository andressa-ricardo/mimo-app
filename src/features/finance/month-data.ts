import type { Budget, MonthEntry } from '@/types/finance';
import { addMonthsToDateKey, getMonthRange, monthsBetween, parseDateKey, type DateKey } from '@/utils/date';

export const TREND_WINDOW = 6;

export type MonthRange = { key: string; start: DateKey; end: DateKey };

export type CategoryTotal = { categoryId: string | null; name: string; amountCents: number };

export type MonthSummary = {
  incomeCents: number;
  expenseCents: number;
  balanceCents: number;
  /** Planned expenses in the month — shown apart, never added to expenseCents. */
  plannedExpenseCents: number;
  byCategory: CategoryTotal[];
  byPaymentMethod: Map<string, number>;
  /** Planned amounts and recurring occurrences, by due date. */
  upcoming: MonthEntry[];
};

export type TrendPoint = MonthRange & { expenseCents: number };

export type BudgetProgress = Budget & { spentCents: number };

export function monthRangeOf(date: Date): MonthRange {
  const { start, end } = getMonthRange(date);
  return { key: start.slice(0, 7), start, end };
}

/** The `count` months ending at `monthStart`, oldest first. */
export function lastMonths(monthStart: DateKey, count: number): MonthRange[] {
  return Array.from({ length: count }, (_, index) =>
    monthRangeOf(parseDateKey(addMonthsToDateKey(monthStart, index - count + 1))),
  );
}

/**
 * Last month of the trend window: the current month while the viewed month
 * is inside the window (the highlight moves, the window stays), otherwise the
 * viewed month itself.
 */
export function trendAnchor(viewedStart: DateKey, currentStart: DateKey): DateKey {
  const distance = monthsBetween(viewedStart, currentStart);
  return distance >= 0 && distance < TREND_WINDOW ? currentStart : viewedStart;
}

export function entriesInMonth(entries: MonthEntry[], month: MonthRange): MonthEntry[] {
  return entries.filter((entry) => entry.dueDate >= month.start && entry.dueDate <= month.end);
}

export function summarizeMonth(entries: MonthEntry[]): MonthSummary {
  let incomeCents = 0;
  let expenseCents = 0;
  let plannedExpenseCents = 0;
  const categories = new Map<string, CategoryTotal>();
  const byPaymentMethod = new Map<string, number>();

  for (const entry of entries) {
    if (entry.status === 'planned') {
      if (entry.type === 'expense') plannedExpenseCents += entry.amountCents;
      continue;
    }
    if (entry.type === 'income') {
      incomeCents += entry.amountCents;
      continue;
    }

    expenseCents += entry.amountCents;
    const categoryKey = entry.categoryId ?? 'none';
    const category = categories.get(categoryKey) ?? {
      categoryId: entry.categoryId,
      name: entry.categoryName ?? 'Sem categoria',
      amountCents: 0,
    };
    category.amountCents += entry.amountCents;
    categories.set(categoryKey, category);
    if (entry.paymentMethodId) {
      byPaymentMethod.set(entry.paymentMethodId, (byPaymentMethod.get(entry.paymentMethodId) ?? 0) + entry.amountCents);
    }
  }

  return {
    incomeCents,
    expenseCents,
    balanceCents: incomeCents - expenseCents,
    plannedExpenseCents,
    byCategory: [...categories.values()].sort((a, b) => b.amountCents - a.amountCents),
    byPaymentMethod,
    upcoming: entries.filter((entry) => entry.status === 'planned' || entry.recurring),
  };
}

export function buildTrend(entries: MonthEntry[], months: MonthRange[]): TrendPoint[] {
  return months.map((month) => ({
    ...month,
    expenseCents: entriesInMonth(entries, month).reduce(
      (total, entry) => (entry.type === 'expense' && entry.status === 'confirmed' ? total + entry.amountCents : total),
      0,
    ),
  }));
}

export function budgetProgress(budgets: Budget[], summary: MonthSummary): BudgetProgress[] {
  return budgets.map((budget) => ({
    ...budget,
    spentCents: summary.byCategory.find((category) => category.categoryId === budget.categoryId)?.amountCents ?? 0,
  }));
}

/** Whole-number percentage without floating-point money math (rounds half up). */
export function percentOf(partCents: number, totalCents: number): number {
  if (totalCents <= 0) return 0;
  return Math.floor((partCents * 100 + Math.floor(totalCents / 2)) / totalCents);
}
