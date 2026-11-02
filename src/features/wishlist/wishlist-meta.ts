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

// Fixed tag palette so a category keeps its dot color across accents and themes.
const categoryPalette = ['#5E9C76', '#D89A4A', '#C9566B', '#6487B8', '#8973AD', '#4E9CA8', '#B77D99'];

export function categoryColor(categoryId: string): string {
  let hash = 0;
  for (const character of categoryId) hash = (hash * 31 + character.charCodeAt(0)) % 1_000_003;
  return categoryPalette[hash % categoryPalette.length];
}

/** Lowercase, accent-insensitive text for search. */
export function searchable(text: string): string {
  return text.normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase();
}
