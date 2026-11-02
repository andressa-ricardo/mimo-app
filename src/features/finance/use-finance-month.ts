import { useEffect, useState } from 'react';

import { listPaymentMethods } from '@/database/repositories/categories-repository';
import {
  getEntriesInRange,
  listActiveInstallments,
  listBudgets,
} from '@/database/repositories/finance-repository';
import {
  buildTrend,
  entriesInMonth,
  lastMonths,
  monthRangeOf,
  summarizeMonth,
  trendAnchor,
  TREND_WINDOW,
  type MonthRange,
  type MonthSummary,
  type TrendPoint,
} from '@/features/finance/month-data';
import { subscribeToDataChanges } from '@/services/events/data-events';
import type { PaymentMethod } from '@/types/categories';
import type { Budget, InstallmentProgress, MonthEntry } from '@/types/finance';

export type FinanceMonthData = {
  entries: MonthEntry[];
  summary: MonthSummary;
  trend: TrendPoint[];
  budgets: Budget[];
  paymentMethods: PaymentMethod[];
  installments: InstallmentProgress[];
};

async function loadFinanceMonth(month: MonthRange): Promise<FinanceMonthData> {
  const months = lastMonths(trendAnchor(month.start, monthRangeOf(new Date()).start), TREND_WINDOW);
  const [rangeEntries, budgets, paymentMethods, installments] = await Promise.all([
    getEntriesInRange(months[0].start, months[months.length - 1].end),
    listBudgets(),
    listPaymentMethods(),
    listActiveInstallments(month.start, month.end),
  ]);
  const entries = entriesInMonth(rangeEntries, month);

  return {
    entries,
    summary: summarizeMonth(entries),
    trend: buildTrend(rangeEntries, months),
    budgets,
    paymentMethods,
    installments,
  };
}

type FinanceMonthState =
  | { status: 'loading'; data: FinanceMonthData | null }
  | { status: 'ready'; data: FinanceMonthData }
  | { status: 'error'; data: FinanceMonthData | null };

/** Loads one month and reloads when finance data changes anywhere in the app. */
export function useFinanceMonth(month: MonthRange): FinanceMonthState {
  const [state, setState] = useState<FinanceMonthState>({ status: 'loading', data: null });
  const { key, start, end } = month;

  useEffect(() => {
    let active = true;
    let requestId = 0;

    const run = () => {
      // The previous month stays on screen until the next one arrives.
      const currentRequest = ++requestId;
      loadFinanceMonth({ key, start, end })
        .then((data) => {
          if (active && currentRequest === requestId) setState({ status: 'ready', data });
        })
        .catch((error: unknown) => {
          console.error('Falha ao carregar Finanças.', error);
          if (active && currentRequest === requestId) setState((current) => ({ status: 'error', data: current.data }));
        });
    };

    run();
    const unsubscribe = subscribeToDataChanges((scope) => {
      if (scope === 'finance') run();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [key, start, end]);

  return state;
}
