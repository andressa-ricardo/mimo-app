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
