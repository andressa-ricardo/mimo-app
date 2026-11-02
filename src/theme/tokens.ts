import type { AccentColor } from '@/types/preferences';

export const accentPalettes = {
  lavender: { primary: '#8973AD', soft: '#EEE8F5', dark: '#C4B0E4' },
  blue: { primary: '#6487B8', soft: '#E8F0FA', dark: '#A3C4EE' },
  green: { primary: '#668F7B', soft: '#E7F2EB', dark: '#A4D0B6' },
  pink: { primary: '#B77D99', soft: '#F8EAF1', dark: '#E4AEC9' },
} satisfies Record<AccentColor, { primary: string; soft: string; dark: string }>;

export const semanticColors = {
  income: '#2E7D4F',
  expense: '#C94C4C',
  success: '#2E7D4F',
  error: '#C94C4C',
  warning: '#B7791F',
  info: '#64748B',
} as const;

const baseColors = {
  light: {
    background: '#FAF9F7',
    surface: '#FFFFFF',
    text: '#25232A',
    textSecondary: '#716D78',
    border: '#E8E4E2',
  },
  dark: {
    background: '#17161B',
    surface: '#211F26',
    text: '#F7F3F8',
    textSecondary: '#B8B2BE',
    border: '#36323C',
  },
} as const;

export function createThemeColors(isDark: boolean, accentColor: AccentColor) {
  const base = baseColors[isDark ? 'dark' : 'light'];
  const accent = accentPalettes[accentColor];

  return {
    ...base,
    accent: isDark ? accent.dark : accent.primary,
    accentSoft: isDark ? '#2B2633' : accent.soft,
    ...semanticColors,
  };
}

export type ThemeColors = ReturnType<typeof createThemeColors>;
