import { randomUUID } from 'expo-crypto';

import { getDatabase } from '@/database/client';
import type { Category, CategoryScope, PaymentMethod } from '@/types/categories';

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

export async function listPaymentMethods(): Promise<PaymentMethod[]> {
  const database = await getDatabase();
  return database.getAllAsync<PaymentMethod>(
    'SELECT id, name FROM payment_methods WHERE archived_at IS NULL ORDER BY created_at',
  );
}

export async function createPaymentMethod(name: string): Promise<PaymentMethod> {
  const normalized = normalizeName(name);
  const existing = (await listPaymentMethods()).find((method) => sameName(method.name, normalized));
  if (existing) return existing;

  const database = await getDatabase();
  const method: PaymentMethod = { id: randomUUID(), name: normalized };
  await database.runAsync(
    'INSERT INTO payment_methods (id, name, created_at) VALUES (?, ?, ?)',
    method.id,
    normalized,
    Date.now(),
  );
  return method;
}
