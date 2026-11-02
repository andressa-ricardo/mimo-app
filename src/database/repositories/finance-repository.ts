import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/database/client';
import { buildEntryDrafts, projectRecurringOccurrences } from '@/features/finance/finance-calculations';
import type {
  Budget,
  InstallmentProgress,
  MonthEntry,
  NewTransactionInput,
  TransactionStatus,
  TransactionType,
} from '@/types/finance';
import type { DateKey } from '@/utils/date';

/** Writes a transaction and its entries; the caller owns the SQL transaction. */
export async function insertTransactionRows(transaction: SQLiteDatabase, input: NewTransactionInput): Promise<void> {
  const entries = buildEntryDrafts(input);
  const now = Date.now();

  await transaction.runAsync(
    `INSERT INTO financial_transactions (
       id, type, description, amount_cents, category_id, payment_method_id, transaction_date,
       installment_count, recurrence_frequency, recurrence_interval, recurrence_end_date, status, created_at, updated_at
     ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, 1, ?, ?, ?, ?)`,
    input.id,
    input.type,
    input.description,
    input.amountCents,
    input.categoryId,
    input.paymentMethodId,
    input.date,
    input.recurring ? 1 : input.installmentCount,
    input.recurring ? 'monthly' : null,
    input.recurring ? input.recurrenceEndDate : null,
    input.status,
    now,
    now,
  );
  await insertEntryRows(transaction, input.id, entries, now);
}

async function insertEntryRows(
  transaction: SQLiteDatabase,
  transactionId: string,
  entries: ReturnType<typeof buildEntryDrafts>,
  now: number,
): Promise<void> {
  for (const entry of entries) {
    await transaction.runAsync(
      `INSERT INTO financial_entries (id, transaction_id, sequence, amount_cents, due_date, status, created_at)
       VALUES (?, ?, ?, ?, ?, ?, ?)`,
      randomUUID(),
      transactionId,
      entry.sequence,
      entry.amountCents,
      entry.dueDate,
      entry.status,
      now,
    );
  }
}

type TransactionRow = {
  id: string;
  type: TransactionType;
  description: string;
  amount_cents: number;
  category_id: string | null;
  payment_method_id: string | null;
  transaction_date: DateKey;
  installment_count: number;
  recurrence_frequency: string | null;
  recurrence_end_date: DateKey | null;
  status: TransactionStatus;
};

export async function getTransaction(id: string): Promise<NewTransactionInput | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<TransactionRow>(
    `SELECT id, type, description, amount_cents, category_id, payment_method_id, transaction_date,
       installment_count, recurrence_frequency, recurrence_end_date, status
     FROM financial_transactions WHERE id = ?`,
    id,
  );
  if (!row) return null;
  return {
    id: row.id,
    type: row.type,
    description: row.description,
    amountCents: row.amount_cents,
    categoryId: row.category_id,
    paymentMethodId: row.payment_method_id,
    date: row.transaction_date,
    installmentCount: row.installment_count,
    recurring: row.recurrence_frequency !== null,
    recurrenceEndDate: row.recurrence_end_date,
    status: row.status,
  };
}

/**
 * Saves edits. Description, category, payment method and the series end date
 * change in place. If the money part changes (value, date, installments,
 * repetition, planned/confirmed), the month entries are rebuilt from scratch
 * — so totals never mix old and new amounts.
 */
export async function updateTransaction(input: NewTransactionInput): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const existing = await transaction.getFirstAsync<TransactionRow>(
      `SELECT id, type, description, amount_cents, category_id, payment_method_id, transaction_date,
         installment_count, recurrence_frequency, recurrence_end_date, status
       FROM financial_transactions WHERE id = ?`,
      input.id,
    );
    if (!existing) throw new Error('Transação não encontrada.');

    const moneyChanged =
      existing.type !== input.type ||
      existing.amount_cents !== input.amountCents ||
      existing.transaction_date !== input.date ||
      existing.installment_count !== (input.recurring ? 1 : input.installmentCount) ||
      (existing.recurrence_frequency !== null) !== input.recurring ||
      existing.status !== input.status;

    await transaction.runAsync(
      `UPDATE financial_transactions SET type = ?, description = ?, amount_cents = ?, category_id = ?,
         payment_method_id = ?, transaction_date = ?, installment_count = ?, recurrence_frequency = ?,
         recurrence_end_date = ?, status = ?, updated_at = ?
       WHERE id = ?`,
      input.type,
      input.description,
      input.amountCents,
      input.categoryId,
      input.paymentMethodId,
      input.date,
      input.recurring ? 1 : input.installmentCount,
      input.recurring ? 'monthly' : null,
      input.recurring ? input.recurrenceEndDate : null,
      input.status,
      now,
      input.id,
    );

    if (moneyChanged) {
      await transaction.runAsync('DELETE FROM financial_entries WHERE transaction_id = ?', input.id);
      await insertEntryRows(transaction, input.id, buildEntryDrafts(input), now);
    } else if (input.recurring && input.recurrenceEndDate) {
      // A new end date drops stored occurrences after it.
      await transaction.runAsync(
        'DELETE FROM financial_entries WHERE transaction_id = ? AND due_date > ?',
        input.id,
        input.recurrenceEndDate,
      );
    }
  });
}

/** Removes the transaction and all its installments/occurrences (cascade). */
export async function deleteTransaction(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM financial_transactions WHERE id = ?', id);
}

/**
 * Ends a recurring series: occurrences up to `lastDate` stay in the history,
 * later ones disappear (stored ones are deleted, projected ones stop).
 */
export async function endRecurringSeries(id: string, lastDate: DateKey): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `UPDATE financial_transactions SET recurrence_end_date = ?, updated_at = ?
       WHERE id = ? AND recurrence_frequency IS NOT NULL`,
      lastDate,
      Date.now(),
      id,
    );
    await transaction.runAsync('DELETE FROM financial_entries WHERE transaction_id = ? AND due_date > ?', id, lastDate);
  });
}

export async function insertTransaction(input: NewTransactionInput): Promise<void> {
  const database = await getDatabase();
  await database.withExclusiveTransactionAsync((transaction) => insertTransactionRows(transaction, input));
}

type EntryRow = {
  entry_id: string;
  transaction_id: string;
  sequence: number;
  amount_cents: number;
  due_date: DateKey;
  status: TransactionStatus;
  type: TransactionType;
  description: string;
  installment_count: number;
  recurrence_frequency: string | null;
  category_id: string | null;
  category_name: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
};

type SeriesRow = {
  id: string;
  type: TransactionType;
  description: string;
  amount_cents: number;
  transaction_date: DateKey;
  recurrence_interval: number;
  recurrence_end_date: DateKey | null;
  status: TransactionStatus;
  category_id: string | null;
  category_name: string | null;
  payment_method_id: string | null;
  payment_method_name: string | null;
};

/**
 * Every amount that falls inside [rangeStart, rangeEnd]: stored entries plus
 * projected occurrences of recurring series (bounded to the range), so a
 * recurring transaction never needs unlimited future rows.
 */
export async function getEntriesInRange(rangeStart: DateKey, rangeEnd: DateKey): Promise<MonthEntry[]> {
  const database = await getDatabase();

  const rows = await database.getAllAsync<EntryRow>(
    `SELECT e.id AS entry_id, e.transaction_id, e.sequence, e.amount_cents, e.due_date, e.status,
       t.type, t.description, t.installment_count, t.recurrence_frequency,
       t.category_id, c.name AS category_name, t.payment_method_id, p.name AS payment_method_name
     FROM financial_entries e
     JOIN financial_transactions t ON t.id = e.transaction_id
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN payment_methods p ON p.id = t.payment_method_id
     WHERE e.due_date BETWEEN ? AND ?`,
    rangeStart,
    rangeEnd,
  );

  const entries: MonthEntry[] = rows.map((row) => ({
    key: `${row.transaction_id}:${row.sequence}`,
    transactionId: row.transaction_id,
    entryId: row.entry_id,
    sequence: row.sequence,
    type: row.type,
    description: row.description,
    amountCents: row.amount_cents,
    dueDate: row.due_date,
    status: row.status,
    categoryId: row.category_id,
    categoryName: row.category_name,
    paymentMethodId: row.payment_method_id,
    paymentMethodName: row.payment_method_name,
    installmentCount: row.installment_count,
    recurring: row.recurrence_frequency !== null,
  }));
  const storedKeys = new Set(entries.map((entry) => entry.key));

  const series = await database.getAllAsync<SeriesRow>(
    `SELECT t.id, t.type, t.description, t.amount_cents, t.transaction_date, t.recurrence_interval,
       t.recurrence_end_date, t.status, t.category_id, c.name AS category_name,
       t.payment_method_id, p.name AS payment_method_name
     FROM financial_transactions t
     LEFT JOIN categories c ON c.id = t.category_id
     LEFT JOIN payment_methods p ON p.id = t.payment_method_id
     WHERE t.recurrence_frequency = 'monthly' AND t.transaction_date <= ?
       AND (t.recurrence_end_date IS NULL OR t.recurrence_end_date >= ?)`,
    rangeEnd,
    rangeStart,
  );

  for (const row of series) {
    const occurrences = projectRecurringOccurrences(
      { startDate: row.transaction_date, intervalMonths: row.recurrence_interval, endDate: row.recurrence_end_date },
      rangeStart,
      rangeEnd,
    );
    for (const occurrence of occurrences) {
      const key = `${row.id}:${occurrence.sequence}`;
      if (storedKeys.has(key)) continue;
      entries.push({
        key,
        transactionId: row.id,
        entryId: null,
        sequence: occurrence.sequence,
        type: row.type,
        description: row.description,
        amountCents: row.amount_cents,
        dueDate: occurrence.dueDate,
        status: row.status,
        categoryId: row.category_id,
        categoryName: row.category_name,
        paymentMethodId: row.payment_method_id,
        paymentMethodName: row.payment_method_name,
        installmentCount: 1,
        recurring: true,
      });
    }
  }

  return entries.sort((a, b) =>
    a.dueDate === b.dueDate ? a.key.localeCompare(b.key) : a.dueDate < b.dueDate ? -1 : 1,
  );
}

/**
 * Confirmed total for a type within a date range. Each installment counts only
 * in its own month; planned amounts never count.
 */
export async function getConfirmedTotal(
  type: TransactionType,
  rangeStart: DateKey,
  rangeEnd: DateKey,
): Promise<number> {
  const entries = await getEntriesInRange(rangeStart, rangeEnd);
  return entries.reduce(
    (total, entry) => (entry.type === type && entry.status === 'confirmed' ? total + entry.amountCents : total),
    0,
  );
}

/**
 * Confirms a planned amount. A stored entry is updated; a projected recurring
 * occurrence is materialized as a confirmed entry (idempotent per sequence).
 */
export async function confirmEntry(entry: MonthEntry): Promise<void> {
  const database = await getDatabase();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (entry.entryId) {
      await transaction.runAsync("UPDATE financial_entries SET status = 'confirmed' WHERE id = ?", entry.entryId);
    } else {
      await transaction.runAsync(
        `INSERT INTO financial_entries (id, transaction_id, sequence, amount_cents, due_date, status, created_at)
         VALUES (?, ?, ?, ?, ?, 'confirmed', ?)
         ON CONFLICT(transaction_id, sequence) DO UPDATE SET status = 'confirmed'`,
        randomUUID(),
        entry.transactionId,
        entry.sequence,
        entry.amountCents,
        entry.dueDate,
        Date.now(),
      );
    }

    // A non-recurring transaction becomes confirmed once nothing is pending.
    await transaction.runAsync(
      `UPDATE financial_transactions SET status = 'confirmed', updated_at = ?
       WHERE id = ? AND recurrence_frequency IS NULL
         AND NOT EXISTS (SELECT 1 FROM financial_entries WHERE transaction_id = ? AND status = 'planned')`,
      Date.now(),
      entry.transactionId,
      entry.transactionId,
    );
  });
}

export async function listBudgets(): Promise<Budget[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ category_id: string; category_name: string; amount_cents: number }>(
    `SELECT b.category_id, c.name AS category_name, b.amount_cents
     FROM budgets b JOIN categories c ON c.id = b.category_id
     WHERE c.archived_at IS NULL
     ORDER BY c.is_system DESC, c.sort_order, c.created_at`,
  );
  return rows.map((row) => ({
    categoryId: row.category_id,
    categoryName: row.category_name,
    amountCents: row.amount_cents,
  }));
}

export async function saveBudget(categoryId: string, amountCents: number): Promise<void> {
  if (!Number.isSafeInteger(amountCents) || amountCents <= 0) throw new Error('Informe um valor maior que zero.');
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    `INSERT INTO budgets (category_id, amount_cents, created_at, updated_at) VALUES (?, ?, ?, ?)
     ON CONFLICT(category_id) DO UPDATE SET amount_cents = excluded.amount_cents, updated_at = excluded.updated_at`,
    categoryId,
    amountCents,
    now,
    now,
  );
}

export async function deleteBudget(categoryId: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('DELETE FROM budgets WHERE category_id = ?', categoryId);
}

/** Purchases split in installments with at least one installment in the range. */
export async function listActiveInstallments(
  rangeStart: DateKey,
  rangeEnd: DateKey,
): Promise<InstallmentProgress[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<{ id: string; description: string; total: number; current: number }>(
    `SELECT t.id, t.description, t.installment_count AS total,
       SUM(CASE WHEN e.due_date <= ? THEN 1 ELSE 0 END) AS current
     FROM financial_transactions t
     JOIN financial_entries e ON e.transaction_id = t.id
     WHERE t.installment_count > 1 AND t.type = 'expense'
     GROUP BY t.id
     HAVING MIN(e.due_date) <= ? AND MAX(e.due_date) >= ?
     ORDER BY MAX(e.due_date)`,
    rangeEnd,
    rangeEnd,
    rangeStart,
  );
  return rows.map((row) => ({
    transactionId: row.id,
    description: row.description,
    current: row.current,
    total: row.total,
  }));
}
