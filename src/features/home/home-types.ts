export type HomeMonthlyFinance = {
  expenseCents: number;
  budgetCents: number | null;
};

export type HomeTask = {
  id: string;
  title: string;
  dueAt: string | null;
  priority: 'high' | 'low' | 'medium' | 'none';
  isOverdue: boolean;
};

export type HomeWishlistItem = {
  id: string;
  name: string;
  priceCents: number | null;
  imageUri: string | null;
};

export type HomeGoal = {
  id: string;
  title: string;
  currentAmountCents: number;
  targetAmountCents: number;
  icon: string | null;
};

export type HomeSummary = {
  monthlyFinance: HomeMonthlyFinance;
  tasks: HomeTask[];
  wishlist: HomeWishlistItem[];
  goals: HomeGoal[];
};
