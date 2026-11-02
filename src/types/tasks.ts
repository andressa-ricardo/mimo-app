import type { DateKey, TimeKey } from '@/utils/date';

export type Priority = 'low' | 'medium' | 'high';

export type NewTaskInput = {
  id: string;
  title: string;
  description: string | null;
  categoryId: string | null;
  dueDate: DateKey;
  dueTime: TimeKey | null;
  priority: Priority;
};
