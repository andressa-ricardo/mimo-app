import { randomUUID } from 'expo-crypto';

import { getDatabase } from '@/database/client';
import { inferPaymentKind } from '@/features/finance/payment-presets';
import type { Category, CategoryScope, PaymentMethod, PaymentMethodDetails } from '@/types/categories';

const MAX_NAME_LENGTH = 40;

function normalizeName(name: string): string {
  const normalized = name.trim().replace(/\s+/g, ' ');
  if (!normalized) throw new Error('Informe um nome.');
  if (normalized.length > MAX_NAME_LENGTH) throw new Error(`Use até ${MAX_NAME_LENGTH} caracteres.`);
  return normalized;
}

function sameName(a: string, b: string): boolean {
  return a.localeCompare(b, 'pt-BR', { sensitivity: 'accent' }) === 0;
}

export async function listCategories(scope: CategoryScope): Promise<Category[]> {
  const database = await getDatabase();
  if (scope === 'goal') {
    return database.getAllAsync<Category>(
      `SELECT id, 'goal' AS scope, name FROM goal_categories
       WHERE archived_at IS NULL
       ORDER BY is_system DESC, sort_order, created_at`,
    );
  }
  return database.getAllAsync<Category>(
    `SELECT id, scope, name FROM categories
     WHERE scope = ? AND archived_at IS NULL
     ORDER BY is_system DESC, sort_order, created_at`,
    scope,
  );
}

/** Returns the existing category when the name is already registered. */
export async function createCategory(scope: CategoryScope, name: string): Promise<Category> {
  const normalized = normalizeName(name);
  const existing = (await listCategories(scope)).find((category) => sameName(category.name, normalized));
  if (existing) return existing;

  const database = await getDatabase();
  const category: Category = { id: randomUUID(), scope, name: normalized };
  if (scope === 'goal') {
    await database.runAsync(
      `INSERT INTO goal_categories (id, name, sort_order, is_system, created_at)
       VALUES (?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM goal_categories), 0, ?)`,
      category.id,
      normalized,
      Date.now(),
    );
    return category;
  }
  await database.runAsync(
    `INSERT INTO categories (id, scope, name, sort_order, is_system, created_at)
     VALUES (?, ?, ?, (SELECT COALESCE(MAX(sort_order), 0) + 1 FROM categories WHERE scope = ?), 0, ?)`,
    category.id,
    scope,
    normalized,
    scope,
    Date.now(),
  );
  return category;
}

type PaymentMethodRow = {
  id: string;
  name: string;
  kind: PaymentMethod['kind'];
  institution: string | null;
  due_day: number | null;
};

function mapPaymentMethod(row: PaymentMethodRow): PaymentMethod {
  return { id: row.id, name: row.name, kind: row.kind, institution: row.institution, dueDay: row.due_day };
}

function normalizeDetails(name: string, details: Partial<PaymentMethodDetails> | undefined): PaymentMethodDetails {
  const kind = details?.kind ?? inferPaymentKind(name);
  const institution = details?.institution?.trim() || null;
  const dueDay = kind === 'credit' ? (details?.dueDay ?? null) : null;
  if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
    throw new Error('Use um dia de vencimento entre 1 e 31.');
  }
  return { kind, institution, dueDay };
}

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<PaymentMethodRow>(
    `SELECT id, name, kind, institution, due_day FROM payment_methods
     WHERE archived_at IS NULL ORDER BY created_at`,
  );
  return rows.map(mapPaymentMethod);
}

/** Returns the existing method when the name is already registered. */
export async function createPaymentMethod(
  name: string,
  details?: Partial<PaymentMethodDetails>,
): Promise<PaymentMethod> {
  const normalized = normalizeName(name);
  const existing = (await listPaymentMethods()).find((method) => sameName(method.name, normalized));
  if (existing) return existing;

  const database = await getDatabase();
  const archived = (
    await database.getAllAsync<{ id: string; name: string }>(
      'SELECT id, name FROM payment_methods WHERE archived_at IS NOT NULL',
    )
  ).find((row) => sameName(row.name, normalized));
  if (archived) {
    // Names are unique, so re-adding an archived method brings it back.
    await database.runAsync('UPDATE payment_methods SET archived_at = NULL WHERE id = ?', archived.id);
    return updatePaymentMethod(archived.id, normalized, details ?? {});
  }

  const method: PaymentMethod = { id: randomUUID(), name: normalized, ...normalizeDetails(normalized, details) };
  await database.runAsync(
    `INSERT INTO payment_methods (id, name, kind, institution, due_day, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    method.id,
    method.name,
    method.kind,
    method.institution,
    method.dueDay,
    Date.now(),
  );
  return method;
}

export async function updatePaymentMethod(
  id: string,
  name: string,
  details: Partial<PaymentMethodDetails>,
): Promise<PaymentMethod> {
  const normalized = normalizeName(name);
  const duplicate = (await listPaymentMethods()).find(
    (method) => method.id !== id && sameName(method.name, normalized),
  );
  if (duplicate) throw new Error('Já existe uma forma de pagamento com esse nome.');

  const database = await getDatabase();
  const method: PaymentMethod = { id, name: normalized, ...normalizeDetails(normalized, details) };
  await database.runAsync(
    'UPDATE payment_methods SET name = ?, kind = ?, institution = ?, due_day = ? WHERE id = ?',
    method.name,
    method.kind,
    method.institution,
    method.dueDay,
    id,
  );
  return method;
}

/** Hides the method from pickers; past transactions keep their reference. */
export async function archivePaymentMethod(id: string): Promise<void> {
  const database = await getDatabase();
  await database.runAsync('UPDATE payment_methods SET archived_at = ? WHERE id = ?', Date.now(), id);
}
