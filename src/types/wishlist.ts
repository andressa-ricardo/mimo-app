import type { PreparedImage } from '@/services/images/image-storage';
import type { Priority } from '@/types/tasks';

export type NewWishlistItemInput = {
  id: string;
  name: string;
  priceCents: number | null;
  productUrl: string | null;
  categoryId: string | null;
  priority: Priority;
  notes: string | null;
};

export type WishlistItem = NewWishlistItemInput & {
  categoryName: string | null;
  imageUri: string | null;
  purchasedAt: number | null;
  purchaseTransactionId: string | null;
  createdAt: number;
};

export type WishlistImageChange =
  | { kind: 'keep' }
  | { kind: 'remove' }
  | { kind: 'replace'; image: PreparedImage };
