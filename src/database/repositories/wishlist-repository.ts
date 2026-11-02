import { randomUUID } from 'expo-crypto';
import type { SQLiteDatabase } from 'expo-sqlite';

import { getDatabase } from '@/database/client';
import { insertTransactionRows } from '@/database/repositories/finance-repository';
import {
  deleteStoredImageFiles,
  storedImageUri,
  type PreparedImage,
} from '@/services/images/image-storage';
import type { NewWishlistItemInput, WishlistImageChange, WishlistItem } from '@/types/wishlist';
import { toDateKey } from '@/utils/date';

export const WISHLIST_FILE_OWNER = 'wishlist_item';
/** Seeded "Compras" expense category, used when a purchase becomes an expense. */
const PURCHASE_EXPENSE_CATEGORY_ID = 'system-expense-6';

type WishlistRow = {
  id: string;
  name: string;
  price_cents: number | null;
  product_url: string | null;
  category_id: string | null;
  category_name: string | null;
  priority: WishlistItem['priority'];
  notes: string | null;
  purchased_at: number | null;
  purchase_transaction_id: string | null;
  created_at: number;
  relative_path: string | null;
};

const SELECT_ITEMS = `
  SELECT w.id, w.name, w.price_cents, w.product_url, w.category_id, c.name AS category_name,
    w.priority, w.notes, w.purchased_at, w.purchase_transaction_id, w.created_at,
    (SELECT f.relative_path FROM file_references r
     JOIN stored_files f ON f.id = r.file_id
     WHERE r.owner_type = '${WISHLIST_FILE_OWNER}' AND r.owner_id = w.id
     ORDER BY r.created_at LIMIT 1) AS relative_path
  FROM wishlist_items w
  LEFT JOIN categories c ON c.id = w.category_id`;

function mapRow(row: WishlistRow): WishlistItem {
  return {
    id: row.id,
    name: row.name,
    priceCents: row.price_cents,
    productUrl: row.product_url,
    categoryId: row.category_id,
    categoryName: row.category_name,
    priority: row.priority,
    notes: row.notes,
    imageUri: storedImageUri(row.relative_path),
    purchasedAt: row.purchased_at,
    purchaseTransactionId: row.purchase_transaction_id,
    createdAt: row.created_at,
  };
}

export async function listWishlistItems(): Promise<WishlistItem[]> {
  const database = await getDatabase();
  const rows = await database.getAllAsync<WishlistRow>(`${SELECT_ITEMS} ORDER BY w.created_at DESC`);
  return rows.map(mapRow);
}

export async function getWishlistItem(id: string): Promise<WishlistItem | null> {
  const database = await getDatabase();
  const row = await database.getFirstAsync<WishlistRow>(`${SELECT_ITEMS} WHERE w.id = ?`, id);
  return row ? mapRow(row) : null;
}

async function insertStoredFile(transaction: SQLiteDatabase, image: PreparedImage, now: number): Promise<void> {
  await transaction.runAsync(
    `INSERT OR IGNORE INTO stored_files (id, relative_path, media_type, byte_size, checksum, created_at)
     VALUES (?, ?, ?, ?, ?, ?)`,
    image.id,
    image.relativePath,
    image.mediaType,
    image.byteSize,
    image.checksum,
    now,
  );
}

async function attachImage(transaction: SQLiteDatabase, itemId: string, image: PreparedImage, now: number) {
  await insertStoredFile(transaction, image, now);
  await transaction.runAsync(
    'INSERT OR IGNORE INTO file_references (owner_type, owner_id, file_id, created_at) VALUES (?, ?, ?, ?)',
    WISHLIST_FILE_OWNER,
    itemId,
    image.id,
    now,
  );
}

/** Removes the item's references; returns their file ids for garbage collection. */
async function detachImages(transaction: SQLiteDatabase, itemId: string): Promise<string[]> {
  const rows = await transaction.getAllAsync<{ file_id: string }>(
    'SELECT file_id FROM file_references WHERE owner_type = ? AND owner_id = ?',
    WISHLIST_FILE_OWNER,
    itemId,
  );
  await transaction.runAsync(
    'DELETE FROM file_references WHERE owner_type = ? AND owner_id = ?',
    WISHLIST_FILE_OWNER,
    itemId,
  );
  return rows.map((row) => row.file_id);
}

/** Deletes stored_files rows nobody references anymore; returns their paths. */
async function collectOrphanFiles(transaction: SQLiteDatabase, fileIds: string[]): Promise<string[]> {
  const orphanPaths: string[] = [];
  for (const fileId of fileIds) {
    const stillUsed = await transaction.getFirstAsync<{ used: number }>(
      'SELECT 1 AS used FROM file_references WHERE file_id = ? LIMIT 1',
      fileId,
    );
    if (stillUsed) continue;
    const file = await transaction.getFirstAsync<{ relative_path: string }>(
      'SELECT relative_path FROM stored_files WHERE id = ?',
      fileId,
    );
    await transaction.runAsync('DELETE FROM stored_files WHERE id = ?', fileId);
    if (file) orphanPaths.push(file.relative_path);
  }
  return orphanPaths;
}

export async function insertWishlistItem(
  input: NewWishlistItemInput,
  image: PreparedImage | null,
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    await transaction.runAsync(
      `INSERT INTO wishlist_items (
         id, name, price_cents, product_url, category_id, priority, notes, created_at, updated_at
       ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`,
      input.id,
      input.name,
      input.priceCents,
      input.productUrl,
      input.categoryId,
      input.priority,
      input.notes,
      now,
      now,
    );
    if (image) await attachImage(transaction, input.id, image, now);
  });
}

export async function updateWishlistItem(
  input: NewWishlistItemInput,
  imageChange: WishlistImageChange,
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  let orphanPaths: string[] = [];

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const result = await transaction.runAsync(
      `UPDATE wishlist_items
       SET name = ?, price_cents = ?, product_url = ?, category_id = ?, priority = ?, notes = ?, updated_at = ?
       WHERE id = ?`,
      input.name,
      input.priceCents,
      input.productUrl,
      input.categoryId,
      input.priority,
      input.notes,
      now,
      input.id,
    );
    if (result.changes === 0) throw new Error('Desejo não encontrado.');

    if (imageChange.kind === 'keep') return;
    const previousFileIds = await detachImages(transaction, input.id);
    if (imageChange.kind === 'replace') await attachImage(transaction, input.id, imageChange.image, now);
    orphanPaths = await collectOrphanFiles(transaction, previousFileIds);
  });

  deleteStoredImageFiles(orphanPaths);
}

export async function setWishlistPurchased(id: string, purchased: boolean): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();
  await database.runAsync(
    'UPDATE wishlist_items SET purchased_at = ?, updated_at = ? WHERE id = ?',
    purchased ? now : null,
    now,
    id,
  );
}

/**
 * Creates a confirmed expense for the item's price (dated today) and links it
 * to the item, atomically. Calling it again for the same item is a no-op.
 */
export async function registerPurchaseExpense(id: string): Promise<'created' | 'already-registered'> {
  const database = await getDatabase();
  let outcome: 'created' | 'already-registered' = 'already-registered';

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const item = await transaction.getFirstAsync<{
      name: string;
      price_cents: number | null;
      purchase_transaction_id: string | null;
    }>('SELECT name, price_cents, purchase_transaction_id FROM wishlist_items WHERE id = ?', id);
    if (!item) throw new Error('Desejo não encontrado.');
    if (item.purchase_transaction_id) return;
    if (item.price_cents === null || item.price_cents <= 0) {
      throw new Error('Informe o preço do produto para registrar o gasto.');
    }

    const category = await transaction.getFirstAsync<{ id: string }>(
      'SELECT id FROM categories WHERE id = ? AND archived_at IS NULL',
      PURCHASE_EXPENSE_CATEGORY_ID,
    );
    const transactionId = randomUUID();
    await insertTransactionRows(transaction, {
      id: transactionId,
      type: 'expense',
      description: item.name,
      amountCents: item.price_cents,
      categoryId: category?.id ?? null,
      paymentMethodId: null,
      date: toDateKey(new Date()),
      installmentCount: 1,
      recurring: false,
      status: 'confirmed',
    });

    const now = Date.now();
    await transaction.runAsync(
      `UPDATE wishlist_items
       SET purchase_transaction_id = ?, purchased_at = COALESCE(purchased_at, ?), updated_at = ?
       WHERE id = ?`,
      transactionId,
      now,
      now,
      id,
    );
    outcome = 'created';
  });

  return outcome;
}

/** Deletes the item; an expense already registered in Finanças is kept. */
export async function deleteWishlistItem(id: string): Promise<void> {
  const database = await getDatabase();
  let orphanPaths: string[] = [];

  await database.withExclusiveTransactionAsync(async (transaction) => {
    const fileIds = await detachImages(transaction, id);
    await transaction.runAsync('DELETE FROM wishlist_items WHERE id = ?', id);
    orphanPaths = await collectOrphanFiles(transaction, fileIds);
  });

  deleteStoredImageFiles(orphanPaths);
}
