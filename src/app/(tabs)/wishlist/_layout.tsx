import { Stack } from 'expo-router';

import { useAppTheme } from '@/theme/theme-provider';

export default function WishlistLayout() {
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
