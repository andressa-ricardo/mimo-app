import type { GoalMovementType, GoalStatus } from '@/types/goals';
import { percentOf } from '@/utils/money';

export function goalStatus(savedCents: number, targetCents: number, archived: boolean): GoalStatus {
  if (archived) return 'archived';
  return savedCents >= targetCents ? 'completed' : 'active';
}

export type GoalProgress = {
  /** 0–100, capped: a goal never shows more than 100%. */
  percent: number;
  /** 0–1 for the progress bar width (geometry only). */
  fraction: number;
  remainingCents: number;
  /** Saved beyond the target, if any. */
  surplusCents: number;
};

export function goalProgress(savedCents: number, targetCents: number): GoalProgress {
  // 100% only when the target is really met — rounding must not complete a goal early.
  const percent = savedCents >= targetCents ? 100 : Math.min(percentOf(Math.max(savedCents, 0), targetCents), 99);
  return {
    percent,
    fraction: targetCents > 0 ? Math.min(Math.max(savedCents, 0) / targetCents, 1) : 0,
    remainingCents: Math.max(targetCents - savedCents, 0),
    surplusCents: Math.max(savedCents - targetCents, 0),
  };
}

export type MovementForBalance = {
  type: GoalMovementType;
  amountCents: number;
  date: string;
  createdAt: number;
};

/**
 * Walks the history in date order and returns the final balance, or null if
 * the balance would dip below zero at any point (e.g. a withdrawal dated
 * before the money it uses was added).
 */
export function runningBalance(movements: MovementForBalance[]): number | null {
  const ordered = [...movements].sort((a, b) =>
    a.date === b.date ? a.createdAt - b.createdAt : a.date < b.date ? -1 : 1,
  );
  let balance = 0;
  for (const movement of ordered) {
    balance += movement.type === 'contribution' ? movement.amountCents : -movement.amountCents;
    if (balance < 0) return null;
  }
  return balance;
}

export const goalStatusLabels: Record<GoalStatus, string> = {
  active: 'Em andamento',
  completed: 'Concluída',
  archived: 'Arquivada',
};

export const goalIcons = ['✈️', '🏠', '🎓', '🛟', '🛍️', '💻', '🚗', '🎧', '🎁', '💍', '🌱', '💰'] as const;
