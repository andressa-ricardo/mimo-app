export const colorSchemes = ['system', 'light', 'dark'] as const;
export const accentColors = ['lavender', 'blue', 'green', 'pink'] as const;

export type ColorSchemePreference = (typeof colorSchemes)[number];
export type AccentColor = (typeof accentColors)[number];

export type AppearancePreferences = {
  colorScheme: ColorSchemePreference;
  accentColor: AccentColor;
};

export const defaultAppearancePreferences: AppearancePreferences = {
  colorScheme: 'system',
  accentColor: 'lavender',
};
