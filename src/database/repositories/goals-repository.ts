import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/database/client';
import { goalStatus, runningBalance } from '@/features/goals/goal-math';
import type { Goal, GoalInput, GoalMovement, GoalMovementInput } from '@/types/goals';
import type { DateKey } from '@/utils/date';

/** Error whose message is safe to show to the user as-is. */
export class GoalError extends Error {}

type GoalRow = {
  id: string;
  title: string;
  description: string | null;
  target_amount_cents: number;
  target_date: DateKey | null;
  icon: string | null;
  category_id: string | null;
  category_name: string | null;
  linked_wishlist_item_id: string | null;
  linked_wishlist_item_name: string | null;
  archived_at: number | null;
  created_at: number;
  saved_cents: number;
};

// The balance is aggregated from the movements on every read.
const SELECT_GOALS = `
  SELECT g.id, g.title, g.description, g.target_amount_cents, g.target_date, g.icon,
    g.category_id, c.name AS category_name,
    g.linked_wishlist_item_id, w.name AS linked_wishlist_item_name,
    g.archived_at, g.created_at,
    COALESCE((
      SELECT SUM(CASE m.type WHEN 'contribution' THEN m.amount_cents ELSE -m.amount_cents END)
      FROM goal_movements m WHERE m.goal_id = g.id
    ), 0) AS saved_cents
  FROM savings_goals g
  LEFT JOIN goal_categories c ON c.id = g.category_id
  LEFT JOIN wishlist_items w ON w.id = g.linked_wishlist_item_id`;

function mapGoal(row: GoalRow): Goal {
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    targetAmountCents: row.target_amount_cents,
    targetDate: row.target_date,
    icon: row.icon,
    categoryId: row.category_id,
    categoryName: row.category_name,
    linkedWishlistItemId: row.linked_wishlist_item_id,
    linkedWishlistItemName: row.linked_wishlist_item_name,
    savedAmountCents: row.saved_cents,
    status: goalStatus(row.saved_cents, row.target_amount_cents, row.archived_at !== null),
    archivedAt: row.archived_at,
    createdAt: row.created_at,
  };
}

export async function listGoals(): Promise<Goal[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<GoalRow>(`${SELECT_GOALS} ORDER BY g.created_at DESC`);
  return rows.map(mapGoal);
}

export async function getGoal(id: string): Promise<Goal | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<GoalRow>(`${SELECT_GOALS} WHERE g.id = ?`, id);
  return row ? mapGoal(row) : null;
}

/** Goals linked to a wishlist item (usually one). */
export async function listGoalsForWishlistItem(itemId: string): Promise<Goal[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<GoalRow>(
    `${SELECT_GOALS} WHERE g.linked_wishlist_item_id = ? ORDER BY g.created_at DESC`,
    itemId,
  );
  return rows.map(mapGoal);
}

export async function listMovements(goalId: string): Promise<GoalMovement[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{
    id: string;
    goal_id: string;
    type: GoalMovement['type'];
    amount_cents: number;
    movement_date: DateKey;
    note: string | null;
    created_at: number;
  }>(
    `SELECT id, goal_id, type, amount_cents, movement_date, note, created_at
     FROM goal_movements WHERE goal_id = ?
     ORDER BY movement_date DESC, created_at DESC`,
    goalId,
  );
  return rows.map((row) => ({
    id: row.id,
    goalId: row.goal_id,
    type: row.type,
    amountCents: row.amount_cents,
    date: row.movement_date,
    note: row.note,
    createdAt: row.created_at,
  }));
}

/**
 * Re-reads the goal's history inside the open transaction and aborts it if the
 * balance would ever go negative. Every movement change goes through here.
 */
async function assertValidHistory(transaction: SQLiteDatabase, goalId: string): Promise<void> {
  const movements = await transaction.getAllAsync<{
    type: GoalMovement['type'];
    amount_cents: number;
    movement_date: DateKey;
    created_at: number;
  }>('SELECT type, amount_cents, movement_date, created_at FROM goal_movements WHERE goal_id = ?', goalId);

  const balance = runningBalance(
    movements.map((movement) => ({
      type: movement.type,
      amountCents: movement.amount_cents,
      date: movement.movement_date,
      createdAt: movement.created_at,
    })),
  );
  if (balance === null) {
    throw new GoalError('Essa alteração deixaria o saldo da meta negativo em algum momento do histórico.');
  }
}

async function insertMovement(
  transaction: SQLiteDatabase,
  goalId: string,
  movement: GoalMovementInput,
  now: number,
): Promise<void> {
  await transaction.runAsync(
    `INSERT INTO goal_movements (id, goal_id, type, amount_cents, movement_date, note, created_at, updated_at)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?)`,
    randomUUID(),
    goalId,
    movement.type,
    movement.amountCents,
    movement.date,
    movement.note,
    now,
    now,
  );
}

/** Creates the goal and, if given, its initial balance as the first contribution — atomically. */
export async function createGoal(input: GoalInput, initialSavedCents: number, today: DateKey): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO savings_goals (
         id, title, description, target_amount_cents, target_date, icon, category_id,
         linked_wishlist_item_id, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.title,
      input.description,
      input.targetAmountCents,
      input.targetDate,
      input.icon,
      input.categoryId,
      input.linkedWishlistItemId,
      now,
      now,
    );
    if (initialSavedCents > 0) {
      await insertMovement(
        transaction,
        input.id,
        { type: 'contribution', amountCents: initialSavedCents, date: today, note: 'Saldo inicial' },
        now,
      );
    }
  });
}

export async function updateGoal(input: GoalInput): Promise<void> {
  const database = await getDatabase();
  const result = await database.runAsync(
    `UPDATE savings_goals SET title = ?, description = ?, target_amount_cents = ?, target_date = ?, icon = ?,
       category_id = ?, linked_wishlist_item_id = ?, updated_at = ?
     WHERE id = ?`,
    input.title,
    input.description,
    input.targetAmountCents,
    input.targetDate,
    input.icon,
    input.categoryId,
    input.linkedWishlistItemId,
    Date.now(),
    input.id,
  );
  if (result.changes === 0) throw new GoalError('Meta não encontrada.');
}

export async function setGoalArchived(id: string, archived: boolean): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    'UPDATE savings_goals SET archived_at = ?, updated_at = ? WHERE id = ?',
    archived ? now : null,
    now,
    id,
  );
}

/** Removes the goal and its history (cascade). Linked items and transactions are untouched. */
export async function deleteGoal(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM savings_goals WHERE id = ?', id);
}

export async function addMovement(goalId: string, movement: GoalMovementInput): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await insertMovement(transaction, goalId, movement, Date.now());
    await assertValidHistory(transaction, goalId);
  });
}

export async function updateMovement(id: string, movement: GoalMovementInput): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<{ goal_id: string }>(
      'SELECT goal_id FROM goal_movements WHERE id = ?',
      id,
    );
    if (!row) throw new GoalError('Lançamento não encontrado.');
    await transaction.runAsync(
      `UPDATE goal_movements SET type = ?, amount_cents = ?, movement_date = ?, note = ?, updated_at = ?
       WHERE id = ?`,
      movement.type,
      movement.amountCents,
      movement.date,
      movement.note,
      Date.now(),
      id,
    );
    await assertValidHistory(transaction, row.goal_id);
  });
}

export async function deleteMovement(id: string): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    const row = await transaction.getFirstAsync<{ goal_id: string }>(
      'SELECT goal_id FROM goal_movements WHERE id = ?',
      id,
    );
    if (!row) return;
    await transaction.runAsync('DELETE FROM goal_movements WHERE id = ?', id);
    await assertValidHistory(transaction, row.goal_id);
  });
}
