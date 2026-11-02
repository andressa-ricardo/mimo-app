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
