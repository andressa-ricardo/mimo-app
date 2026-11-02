import { getDatabase } from '@/database/client';
import type { PreparedImage } from '@/services/images/image-storage';
import type { NewWishlistItemInput } from '@/types/wishlist';

export const WISHLIST_FILE_OWNER = 'wishlist_item';

export async function insertWishlistItem(
  input: NewWishlistItemInput,
  image: PreparedImage | null,
): Promise<void> {
  const database = await getDatabase();
  const now = Date.now();

  await database.withExclusiveTransactionAsync(async (transaction) => {
    if (image) {
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

    if (image) {
      await transaction.runAsync(
        'INSERT INTO file_references (owner_type, owner_id, file_id, created_at) VALUES (?, ?, ?, ?)',
        WISHLIST_FILE_OWNER,
        input.id,
        image.id,
        now,
      );
    }
  });
}
