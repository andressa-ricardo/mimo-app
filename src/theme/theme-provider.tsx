import { createContext, useCallback, useContext, useMemo, useState, type ReactNode } from 'react';
import { useColorScheme } from 'react-native';

import { saveAppearancePreferences } from '@/database/repositories/preferences-repository';
import { createThemeColors, type ThemeColors } from '@/theme/tokens';
import type { AppearancePreferences } from '@/types/preferences';

type AppThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preferences: AppearancePreferences;
  setPreferences: (preferences: AppearancePreferences) => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

type AppThemeProviderProps = {
  children: ReactNode;
  initialPreferences: AppearancePreferences;
};

export function AppThemeProvider({ children, initialPreferences }: AppThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferencesState] = useState(initialPreferences);
  const isDark =
    preferences.colorScheme === 'system'
      ? systemScheme === 'dark'
      : preferences.colorScheme === 'dark';

  const setPreferences = useCallback(async (nextPreferences: AppearancePreferences) => {
    await saveAppearancePreferences(nextPreferences);
    setPreferencesState(nextPreferences);
  }, []);

  const value = useMemo<AppThemeContextValue>(
    () => ({
      colors: createThemeColors(isDark, preferences.accentColor),
      isDark,
      preferences,
      setPreferences,
    }),
    [isDark, preferences, setPreferences],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme deve ser usado dentro de AppThemeProvider.');
  return context;
}
