import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/database/client';
import { buildEntryDrafts, projectRecurringOccurrences } from '@/features/finance/finance-calculations';
import type { NewTransactionInput, TransactionType } from '@/types/finance';
import type { DateKey } from '@/utils/date';

/** Writes a transaction and its entries; the caller owns the SQL transaction. */
export async function insertTransactionRows(transaction: SQLiteDatabase, input: NewTransactionInput): Promise<void> {
  const entries = buildEntryDrafts(input);
  const now = Date.now();

  await transaction.runAsync(
    `INSERT INTO financial_transactions (
       id, type, description, amount_cents, category_id, payment_method_id, transaction_date,
       installment_count, recurrence_frequency, recurrence_interval, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?)`,
    input.id,
    input.type,
    input.description,
    input.amountCents,
    input.categoryId,
    input.paymentMethodId,
    input.date,
    input.recurring ? 1 : input.installmentCount,
    input.recurring ? 'monthly' : null,
    input.status,
    now,
    now,
  );

  for (const entry of entries) {
    await transaction.runAsync(
      `INSERT INTO financial_entries (id, transaction_id, sequence, amount_cents, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      input.id,
      entry.sequence,
      entry.amountCents,
      entry.dueDate,
      entry.status,
      now,
    );
  }
}

export async function insertTransaction(input: NewTransactionInput): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync((transaction) => insertTransactionRows(transaction, input));
}

type RecurringRow = {
  id: string;
  amount_cents: number;
  transaction_date: DateKey;
  recurrence_interval: number;
  recurrence_end_date: DateKey | null;
};

/**
 * Confirmed total for a type within a date range: materialized confirmed
 * entries (each installment counts only in its own month) plus projected
 * occurrences of confirmed recurring series that were not materialized yet.
 * Planned transactions never count.
 */
export async function getConfirmedTotal(
  type: TransactionType,
  rangeStart: DateKey,
  rangeEnd: DateKey,
): Promise<number> {
  const database = await getDatabase();

  const materialized = await database.getFirstAsync<{ total: number }>(
    `SELECT COALESCE(SUM(e.amount_cents), 0) AS total
     FROM financial_entries e
     JOIN financial_transactions t ON t.id = e.transaction_id
     WHERE t.type = ? AND e.status = 'confirmed' AND e.due_date BETWEEN ? AND ?`,
    type,
    rangeStart,
    rangeEnd,
  );

  const series = await database.getAllAsync<RecurringRow>(
    `SELECT id, amount_cents, transaction_date, recurrence_interval, recurrence_end_date
     FROM financial_transactions
     WHERE recurrence_frequency = 'monthly' AND type = ? AND status = 'confirmed'
       AND transaction_date <= ? AND (recurrence_end_date IS NULL OR recurrence_end_date >= ?)`,
    type,
    rangeEnd,
    rangeStart,
  );

  let projected = 0;
  for (const row of series) {
    const existing = await database.getAllAsync<{ sequence: number }>(
      'SELECT sequence FROM financial_entries WHERE transaction_id = ? AND due_date BETWEEN ? AND ?',
      row.id,
      rangeStart,
      rangeEnd,
    );
    const materializedSequences = new Set(existing.map((entry) => entry.sequence));
    const occurrences = projectRecurringOccurrences(
      { startDate: row.transaction_date, intervalMonths: row.recurrence_interval, endDate: row.recurrence_end_date },
      rangeStart,
      rangeEnd,
    );
    for (const occurrence of occurrences) {
      if (!materializedSequences.has(occurrence.sequence)) projected += row.amount_cents;
    }
  }

  return (materialized?.total ?? 0) + projected;
}
