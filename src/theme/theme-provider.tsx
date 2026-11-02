import {
  createContext,
  useCallback,
  useContext,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { useColorScheme } from 'react-native';

import {
  saveAppearancePreferences,
  saveProfilePreferences,
} from '@/database/repositories/preferences-repository';
import { createThemeColors, type ThemeColors } from '@/theme/tokens';
import type { AppearancePreferences, ProfilePreferences } from '@/types/preferences';

type AppThemeContextValue = {
  colors: ThemeColors;
  isDark: boolean;
  preferences: AppearancePreferences;
  profile: ProfilePreferences;
  updatePreferences: (preferences: Partial<AppearancePreferences>) => Promise<void>;
  setPreferredName: (preferredName: string) => Promise<void>;
  completeOnboarding: (preferredName: string) => Promise<void>;
};

const AppThemeContext = createContext<AppThemeContextValue | null>(null);

type AppThemeProviderProps = {
  children: ReactNode;
  initialPreferences: AppearancePreferences;
  initialProfile: ProfilePreferences;
};

export function AppThemeProvider({
  children,
  initialPreferences,
  initialProfile,
}: AppThemeProviderProps) {
  const systemScheme = useColorScheme();
  const [preferences, setPreferencesState] = useState(initialPreferences);
  const preferencesRef = useRef(initialPreferences);
  const persistedPreferencesRef = useRef(initialPreferences);
  const preferencesWriteQueue = useRef<Promise<void>>(Promise.resolve());
  const [profile, setProfile] = useState(initialProfile);
  const isDark =
    preferences.colorScheme === 'system'
      ? systemScheme === 'dark'
      : preferences.colorScheme === 'dark';

  const updatePreferences = useCallback(async (change: Partial<AppearancePreferences>) => {
    const previousPreferences = preferencesRef.current;
    const nextPreferences = { ...previousPreferences, ...change };
    preferencesRef.current = nextPreferences;
    setPreferencesState(nextPreferences);

    const saveOperation = preferencesWriteQueue.current.then(async () => {
      await saveAppearancePreferences(nextPreferences);
      persistedPreferencesRef.current = nextPreferences;
    });
    preferencesWriteQueue.current = saveOperation.catch(() => undefined);

    try {
      await saveOperation;
    } catch (error: unknown) {
      if (preferencesRef.current === nextPreferences) {
        preferencesRef.current = persistedPreferencesRef.current;
        setPreferencesState(persistedPreferencesRef.current);
      }
      throw error;
    }
  }, []);

  const setPreferredName = useCallback(
    async (preferredName: string) => {
      const nextProfile = { ...profile, preferredName: preferredName.trim() };
      await saveProfilePreferences(nextProfile);
      setProfile(nextProfile);
    },
    [profile],
  );

  const completeOnboarding = useCallback(
    async (preferredName: string) => {
      const nextProfile = {
        preferredName: preferredName.trim(),
        onboardingCompleted: true,
      };
      await saveProfilePreferences(nextProfile);
      setProfile(nextProfile);
    },
    [],
  );

  const value = useMemo<AppThemeContextValue>(
    () => ({
      colors: createThemeColors(isDark, preferences.accentColor),
      isDark,
      preferences,
      profile,
      updatePreferences,
      setPreferredName,
      completeOnboarding,
    }),
    [completeOnboarding, isDark, preferences, profile, setPreferredName, updatePreferences],
  );

  return <AppThemeContext.Provider value={value}>{children}</AppThemeContext.Provider>;
}

export function useAppTheme(): AppThemeContextValue {
  const context = useContext(AppThemeContext);
  if (!context) throw new Error('useAppTheme deve ser usado dentro de AppThemeProvider.');
  return context;
}
