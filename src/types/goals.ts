import type { DateKey } from '@/utils/date';

export type GoalStatus = 'active' | 'completed' | 'archived';
export type GoalMovementType = 'contribution' | 'withdrawal';

export type GoalInput = {
  id: string;
  title: string;
  description: string | null;
  targetAmountCents: number;
  targetDate: DateKey | null;
  icon: string | null;
  categoryId: string | null;
  linkedWishlistItemId: string | null;
};

export type Goal = GoalInput & {
  categoryName: string | null;
  linkedWishlistItemName: string | null;
  /** Contributions minus withdrawals — derived from goal_movements. */
  savedAmountCents: number;
  status: GoalStatus;
  archivedAt: number | null;
  createdAt: number;
};

export type GoalMovement = {
  id: string;
  goalId: string;
  type: GoalMovementType;
  amountCents: number;
  date: DateKey;
  note: string | null;
  createdAt: number;
};

export type GoalMovementInput = {
  type: GoalMovementType;
  amountCents: number;
  date: DateKey;
  note: string | null;
};
