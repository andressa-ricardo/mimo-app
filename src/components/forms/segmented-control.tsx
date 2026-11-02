import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

export type SegmentOption<T extends string> = {
  value: T;
  label: string;
  /** Optional semantic color for the selected label (e.g. income/expense). */
  selectedColor?: string;
};

type SegmentedControlProps<T extends string> = {
  accessibilityLabel: string;
  onChange: (value: T) => void;
  options: readonly SegmentOption<T>[];
  value: T;
};

export function SegmentedControl<T extends string>({
  accessibilityLabel,
  onChange,
  options,
  value,
}: SegmentedControlProps<T>) {
  const { colors, isDark } = useAppTheme();

  return (
    <View
      accessibilityLabel={accessibilityLabel}
      accessibilityRole="radiogroup"
      style={[styles.track, { backgroundColor: colors.muted }]}>
      {options.map((option) => {
        const selected = option.value === value;
        return (
          <Pressable
            accessibilityRole="radio"
            accessibilityState={{ checked: selected }}
            key={option.value}
            onPress={() => onChange(option.value)}
            style={[
              styles.segment,
              selected && [styles.selected, { backgroundColor: isDark ? colors.border : colors.surface }],
            ]}>
            <AppText
              color={selected ? 'primary' : 'secondary'}
              style={selected && option.selectedColor ? { color: option.selectedColor } : undefined}
              variant="label">
              {option.label}
            </AppText>
          </Pressable>
        );
      })}
    </View>
  );
}

const styles = StyleSheet.create({
  segment: {
    alignItems: 'center',
    borderRadius: 10,
    flex: 1,
    justifyContent: 'center',
    minHeight: 36,
  },
  selected: {
    elevation: 1,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.06,
    shadowRadius: 3,
  },
  track: {
    borderRadius: 13,
    flexDirection: 'row',
    gap: 3,
    padding: 3,
  },
});
