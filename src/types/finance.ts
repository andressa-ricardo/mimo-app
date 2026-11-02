import type { DateKey } from '@/utils/date';

export type TransactionType = 'expense' | 'income';
export type TransactionStatus = 'confirmed' | 'planned';

export type NewTransactionInput = {
  id: string;
  type: TransactionType;
  description: string;
  /** Full purchase amount in cents (per-occurrence amount for recurring series). */
  amountCents: number;
  categoryId: string | null;
  paymentMethodId: string | null;
  date: DateKey;
  installmentCount: number;
  recurring: boolean;
  status: TransactionStatus;
};
