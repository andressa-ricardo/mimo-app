import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/theme-provider';

// Keeps the list under a goal opened from elsewhere (e.g. the Home).
export const unstable_settings = { initialRouteName: 'index' };

export default function GoalsLayout() {
  const { colors } = useAppTheme();

  return (
    <Stack
      screenOptions={{
        animation: 'slide_from_right',
        contentStyle: { backgroundColor: colors.background },
        headerShown: false,
      }}
    />
  );
}
