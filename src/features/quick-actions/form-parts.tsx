import { StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

export function FormError({ message }: { message: string }) {
  const { colors } = useAppTheme();
  return (
    <AppText
      accessibilityLiveRegion="assertive"
      accessibilityRole="alert"
      style={{ color: colors.error }}
      variant="caption">
      {message}
    </AppText>
  );
}

export const formStyles = StyleSheet.create({
  group: {
    gap: 7,
  },
  half: {
    flex: 1,
  },
  row: {
    flexDirection: 'row',
    gap: 10,
  },
});
