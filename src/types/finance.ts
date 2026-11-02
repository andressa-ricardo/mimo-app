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
  /** Last day a recurring series still occurs (inclusive); null = no end. */
  recurrenceEndDate: DateKey | null;
  status: TransactionStatus;
};

/**
 * One amount that falls on a given day: a stored entry (installment or
 * confirmed occurrence) or a projected occurrence of a recurring series.
 */
export type MonthEntry = {
  /** `${transactionId}:${sequence}` — unique across stored and projected. */
  key: string;
  transactionId: string;
  /** Null for projected recurring occurrences. */
  entryId: string | null;
  sequence: number;
  type: TransactionType;
  description: string;
  amountCents: number;
  dueDate: DateKey;
  status: TransactionStatus;
  categoryId: string | null;
  categoryName: string | null;
  paymentMethodId: string | null;
  paymentMethodName: string | null;
  installmentCount: number;
  recurring: boolean;
};

export type Budget = {
  categoryId: string;
  categoryName: string;
  amountCents: number;
};

export type InstallmentProgress = {
  transactionId: string;
  description: string;
  /** Installments due up to the end of the viewed month. */
  current: number;
  total: number;
};
