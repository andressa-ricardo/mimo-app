import type { ThemeColors } from '@/theme/tokens';
import type { Priority } from '@/types/tasks';

export const priorityLabels: Record<Priority, string> = {
  low: 'Baixa',
  medium: 'Média',
  high: 'Alta',
};

export function priorityColor(priority: Priority, colors: ThemeColors): string {
  if (priority === 'high') return colors.error;
  if (priority === 'medium') return colors.warning;
  return colors.success;
}

export const priorityRank: Record<Priority, number> = { high: 0, medium: 1, low: 2 };

const COMBINING_MARKS = new RegExp('[\\u0300-\\u036f]', 'g');

/** Lowercase, accent-insensitive text for search. */
export function searchable(text: string): string {
  return text.normalize('NFD').replace(COMBINING_MARKS, '').toLowerCase();
}
