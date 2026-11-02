import { getSetting, setSetting } from '@/database/repositories/settings-repository';
import {
  accentColors,
  colorSchemes,
  defaultAppearancePreferences,
  type AccentColor,
  type AppearancePreferences,
  type ColorSchemePreference,
  defaultNotificationPreferences,
  defaultProfilePreferences,
  type NotificationPreferences,
  type ProfilePreferences,
} from '@/types/preferences';

const APPEARANCE_KEY = 'appearance';
const PROFILE_KEY = 'profile';
const NOTIFICATIONS_KEY = 'notifications';

function isColorScheme(value: string | null): value is ColorSchemePreference {
  return colorSchemes.some((option) => option === value);
}

function isAccentColor(value: string | null): value is AccentColor {
  return accentColors.some((option) => option === value);
}

export async function getAppearancePreferences(): Promise<AppearancePreferences> {
  const storedValue = await getSetting(APPEARANCE_KEY);

  if (!storedValue) return defaultAppearancePreferences;

  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (typeof parsed !== 'object' || parsed === null) return defaultAppearancePreferences;

    const { colorScheme, accentColor } = parsed as Record<string, unknown>;
    const validColorScheme = typeof colorScheme === 'string' ? colorScheme : null;
    const validAccentColor = typeof accentColor === 'string' ? accentColor : null;

    return {
      colorScheme: isColorScheme(validColorScheme)
        ? validColorScheme
        : defaultAppearancePreferences.colorScheme,
      accentColor: isAccentColor(validAccentColor)
        ? validAccentColor
        : defaultAppearancePreferences.accentColor,
    };
  } catch {
    return defaultAppearancePreferences;
  }
}

export async function saveAppearancePreferences(
  preferences: AppearancePreferences,
): Promise<void> {
  await setSetting(APPEARANCE_KEY, JSON.stringify(preferences));
}

export async function getProfilePreferences(): Promise<ProfilePreferences> {
  const storedValue = await getSetting(PROFILE_KEY);
  if (!storedValue) return defaultProfilePreferences;

  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (typeof parsed !== 'object' || parsed === null) return defaultProfilePreferences;

    const { preferredName, onboardingCompleted } = parsed as Record<string, unknown>;
    return {
      preferredName: typeof preferredName === 'string' ? preferredName : '',
      onboardingCompleted: onboardingCompleted === true,
    };
  } catch {
    return defaultProfilePreferences;
  }
}

export async function saveProfilePreferences(preferences: ProfilePreferences): Promise<void> {
  await setSetting(PROFILE_KEY, JSON.stringify(preferences));
}

export async function getNotificationPreferences(): Promise<NotificationPreferences> {
  const storedValue = await getSetting(NOTIFICATIONS_KEY);
  if (!storedValue) return defaultNotificationPreferences;

  try {
    const parsed: unknown = JSON.parse(storedValue);
    if (typeof parsed !== 'object' || parsed === null) return defaultNotificationPreferences;

    const values = parsed as Record<string, unknown>;
    const read = (key: keyof NotificationPreferences) =>
      typeof values[key] === 'boolean' ? (values[key] as boolean) : defaultNotificationPreferences[key];
    return {
      taskReminders: read('taskReminders'),
      billReminders: read('billReminders'),
      goalProgress: read('goalProgress'),
    };
  } catch {
    return defaultNotificationPreferences;
  }
}

export async function saveNotificationPreferences(preferences: NotificationPreferences): Promise<void> {
  await setSetting(NOTIFICATIONS_KEY, JSON.stringify(preferences));
}
