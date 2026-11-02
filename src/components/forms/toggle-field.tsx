import { Children, Fragment, type ReactNode } from 'react';
import { StyleSheet, Switch, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

type ToggleFieldProps = {
  description?: string;
  disabled?: boolean;
  label: string;
  onChange: (value: boolean) => void;
  value: boolean;
};

export function ToggleField({ description, disabled = false, label, onChange, value }: ToggleFieldProps) {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.row, disabled && styles.disabled]}>
      <View style={styles.copy}>
        <AppText>{label}</AppText>
        {description ? (
          <AppText color="secondary" variant="caption">
            {description}
          </AppText>
        ) : null}
      </View>
      <Switch
        accessibilityHint={description}
        accessibilityLabel={label}
        disabled={disabled}
        onValueChange={onChange}
        thumbColor={colors.surface}
        trackColor={{ false: colors.border, true: colors.accent }}
        value={value}
      />
    </View>
  );
}

/** Card that stacks toggles with hairline dividers, as in the prototype. */
export function ToggleGroup({ children }: { children: ReactNode }) {
  const { colors } = useAppTheme();
  const items = Children.toArray(children);

  return (
    <View style={[styles.group, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {items.map((child, index) => (
        <Fragment key={index}>
          {index > 0 ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
          {child}
        </Fragment>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  copy: {
    flex: 1,
    gap: 2,
    paddingRight: 12,
  },
  disabled: {
    opacity: 0.55,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  group: {
    borderRadius: 14,
    borderWidth: 1,
    overflow: 'hidden',
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
});
