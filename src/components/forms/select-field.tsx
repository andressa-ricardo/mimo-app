import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { InlineAddInput } from '@/components/forms/inline-add-input';
import { FormField, inputStyles } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

export type SelectOption = { value: string; label: string };

type SelectFieldProps = {
  addLabel: string;
  addPlaceholder: string;
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
  noneLabel: string;
  onAdd: (name: string) => Promise<string>;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  value: string | null;
};

/** Dropdown that expands inline (no nested modal), with a neutral "none" option. */
export function SelectField({
  addLabel,
  addPlaceholder,
  containerStyle,
  label,
  noneLabel,
  onAdd,
  onChange,
  options,
  value,
}: SelectFieldProps) {
  const { colors } = useAppTheme();
  const [open, setOpen] = useState(false);
  const [adding, setAdding] = useState(false);
  const selected = options.find((option) => option.value === value);
  const rows: { value: string | null; label: string }[] = [{ value: null, label: noneLabel }, ...options];

  const choose = (next: string | null) => {
    onChange(next);
    setOpen(false);
    setAdding(false);
  };

  return (
    <FormField label={label} style={containerStyle}>
      <Pressable
        accessibilityLabel={`${label}: ${selected?.label ?? noneLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => setOpen((current) => !current)}
        style={[
          inputStyles.box,
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: open ? colors.accent : colors.border },
        ]}>
        <AppText color={selected ? 'primary' : 'secondary'} numberOfLines={1} style={styles.flex}>
          {selected?.label ?? noneLabel}
        </AppText>
        <Ionicons color={colors.text} name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>

      {open ? (
        <View style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {rows.map((row) => {
            const isSelected = row.value === value;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: isSelected }}
                key={row.value ?? 'none'}
                onPress={() => choose(row.value)}
                style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.muted }]}>
                <AppText color={row.value === null ? 'secondary' : 'primary'} numberOfLines={1} style={styles.flex}>
                  {row.label}
                </AppText>
                {isSelected ? <Ionicons color={colors.accent} name="checkmark" size={16} /> : null}
              </Pressable>
            );
          })}
          <View style={[styles.divider, { backgroundColor: colors.border }]} />
          {adding ? (
            <View style={styles.addRow}>
              <InlineAddInput
                onCancel={() => setAdding(false)}
                onSubmit={async (name) => choose(await onAdd(name))}
                placeholder={addPlaceholder}
              />
            </View>
          ) : (
            <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.option}>
              <AppText color="accent" numberOfLines={1} variant="label">
                + {addLabel}
              </AppText>
            </Pressable>
          )}
        </View>
      ) : null}
    </FormField>
  );
}

const styles = StyleSheet.create({
  addRow: {
    padding: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
  },
  menu: {
    borderRadius: 13,
    borderWidth: 1,
    overflow: 'hidden',
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  trigger: {
    gap: 8,
    justifyContent: 'space-between',
  },
});
