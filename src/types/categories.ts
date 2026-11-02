/** 'goal' categories live in their own table (see migration 5). */
export type CategoryScope = 'task' | 'expense' | 'income' | 'wishlist' | 'goal';

export type Category = {
  id: string;
  scope: CategoryScope;
  name: string;
};

export type PaymentMethodKind = 'credit' | 'debit' | 'pix' | 'cash' | 'other';

export type PaymentMethod = {
  id: string;
  name: string;
  kind: PaymentMethodKind;
  institution: string | null;
  /** Credit card due day (1–31). */
  dueDay: number | null;
};

export type PaymentMethodDetails = Pick<PaymentMethod, 'kind' | 'institution' | 'dueDay'>;
