import type { HomeSummary } from '@/features/home/home-types';

const emptyHomeSummary: HomeSummary = {
  monthlyFinance: {
    expenseCents: 0,
    budgetCents: null,
  },
  tasks: [],
  plans: [],
  wishlist: [],
  goals: [],
  notes: [],
};

/**
 * Aggregation boundary for the Home screen.
 *
 * Each module repository will contribute a small, limited summary query here.
 * Until those schemas exist, returning explicit empty collections keeps the UI
 * truthful without persisting or shipping demonstration records.
 */
export async function loadHomeSummary(): Promise<HomeSummary> {
  return emptyHomeSummary;
}
