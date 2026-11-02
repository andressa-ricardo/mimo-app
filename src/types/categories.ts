export type CategoryScope = 'task' | 'expense' | 'income' | 'wishlist';

export type Category = {
  id: string;
  scope: CategoryScope;
  name: string;
};

export type PaymentMethod = {
  id: string;
  name: string;
};
