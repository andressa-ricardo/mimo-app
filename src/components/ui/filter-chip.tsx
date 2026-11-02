import { Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

type FilterChipProps = {
  label: string;
  onPress: () => void;
  selected: boolean;
};

export function FilterChip({ label, onPress, selected }: FilterChipProps) {
  const { colors } = useAppTheme();

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      onPress={onPress}
      style={({ pressed }) => [
        styles.chip,
        selected
          ? { backgroundColor: colors.accent, borderColor: colors.accent }
          : { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <AppText style={selected ? { color: colors.onAccent } : undefined} variant="label">
        {label}
      </AppText>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  chip: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 16,
  },
  pressed: {
    opacity: 0.75,
  },
});
