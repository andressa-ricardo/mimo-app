import { useCallback, useEffect, useState } from 'react';

import { listGoalSections } from '@/database/repositories/goal-plan-repository';
import {
  getGoal,
  listGoals,
  listGoalsForWishlistItem,
  listMovements,
} from '@/database/repositories/goals-repository';
import { subscribeToDataChanges, type DataChangeScope } from '@/services/events/data-events';
import type { Goal, GoalMovement, GoalSection } from '@/types/goals';

type LoadState<T> =
  | { status: 'loading'; data: null }
  | { status: 'ready'; data: T }
  | { status: 'error'; data: null };

/** Loads data and reloads it when any of the given scopes change. */
function useLiveQuery<T>(load: () => Promise<T>, scopes: readonly DataChangeScope[]): LoadState<T> {
  const [state, setState] = useState<LoadState<T>>({ status: 'loading', data: null });
  const scopeKey = scopes.join(',');

  useEffect(() => {
    let active = true;
    let requestId = 0;
    const run = () => {
      const currentRequest = ++requestId;
      load()
        .then((data) => {
          if (active && currentRequest === requestId) setState({ status: 'ready', data });
        })
        .catch((error: unknown) => {
          console.error('Falha ao carregar metas.', error);
          if (active && currentRequest === requestId) {
            setState((current) => (current.status === 'ready' ? current : { status: 'error', data: null }));
          }
        });
    };
    run();
    const watched = new Set(scopeKey.split(','));
    const unsubscribe = subscribeToDataChanges((scope) => {
      if (watched.has(scope)) run();
    });
    return () => {
      active = false;
      unsubscribe();
    };
  }, [load, scopeKey]);

  return state;
}

// Goal names show linked wishlist items, so wishlist edits refresh them too.
const GOAL_SCOPES = ['goals', 'wishlist'] as const;

export function useGoals(): LoadState<Goal[]> {
  return useLiveQuery(listGoals, GOAL_SCOPES);
}

export type GoalDetailData = { goal: Goal | null; movements: GoalMovement[]; sections: GoalSection[] };

export function useGoalDetail(id: string): LoadState<GoalDetailData> {
  const load = useCallback(async () => {
    const [goal, movements, sections] = await Promise.all([getGoal(id), listMovements(id), listGoalSections(id)]);
    return { goal, movements, sections };
  }, [id]);
  return useLiveQuery(load, GOAL_SCOPES);
}

export function useGoalsForWishlistItem(itemId: string): LoadState<Goal[]> {
  const load = useCallback(() => listGoalsForWishlistItem(itemId), [itemId]);
  return useLiveQuery(load, GOAL_SCOPES);
}
