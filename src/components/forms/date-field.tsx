import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { FormField, inputStyles } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';
import { formatDateKey, parseDateKey, toDateKey, type DateKey } from '@/utils/date';

type DateFieldProps = {
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
  onChange: (value: DateKey) => void;
  value: DateKey;
};

export function DateField({ containerStyle, label, onChange, value }: DateFieldProps) {
  const { colors, isDark } = useAppTheme();
  const date = parseDateKey(value);

  if (Platform.OS === 'ios') {
    return (
      <FormField label={label} style={containerStyle}>
        <View style={[inputStyles.box, styles.iosBox, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <DateTimePicker
            accentColor={colors.accent}
            accessibilityLabel={label}
            display="compact"
            locale="pt-BR"
            mode="date"
            onValueChange={(_, selected) => onChange(toDateKey(selected))}
            themeVariant={isDark ? 'dark' : 'light'}
            value={date}
          />
        </View>
      </FormField>
    );
  }

  return (
    <FormField label={label} style={containerStyle}>
      <Pressable
        accessibilityHint="Abre o calendário"
        accessibilityLabel={`${label}: ${formatDateKey(value)}`}
        accessibilityRole="button"
        onPress={() =>
          DateTimePickerAndroid.open({
            mode: 'date',
            value: date,
            onValueChange: (_, selected) => onChange(toDateKey(selected)),
          })
        }
        style={({ pressed }) => [
          inputStyles.box,
          styles.box,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && styles.pressed,
        ]}>
        <AppText>{formatDateKey(value)}</AppText>
        <Ionicons color={colors.textSecondary} name="calendar-outline" size={17} />
      </Pressable>
    </FormField>
  );
}

export const pickerFieldStyles = StyleSheet.create({
  box: {
    justifyContent: 'space-between',
  },
  iosBox: {
    paddingHorizontal: 6,
  },
  pressed: {
    opacity: 0.7,
  },
});

const styles = pickerFieldStyles;

type OptionalDateFieldProps = {
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
  onChange: (value: DateKey | null) => void;
  placeholder?: string;
  value: DateKey | null;
};

/** Date that can be left empty: shows a placeholder until chosen, with a clear button once set. */
export function OptionalDateField({
  containerStyle,
  label,
  onChange,
  placeholder = 'Sem data',
  value,
}: OptionalDateFieldProps) {
  const { colors } = useAppTheme();

  if (value !== null) {
    return (
      <View style={containerStyle}>
        <DateField label={label} onChange={onChange} value={value} />
        <Pressable
          accessibilityLabel={`Remover ${label.toLowerCase()}`}
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => onChange(null)}
          style={optionalStyles.clear}>
          <Ionicons color={colors.textSecondary} name="close-circle" size={18} />
        </Pressable>
      </View>
    );
  }

  const open = () => {
    const today = new Date();
    if (Platform.OS === 'ios') {
      onChange(toDateKey(today));
      return;
    }
    DateTimePickerAndroid.open({
      mode: 'date',
      value: today,
      onValueChange: (_, selected) => onChange(toDateKey(selected)),
    });
  };

  return (
    <FormField label={label} style={containerStyle}>
      <Pressable
        accessibilityHint="Abre o calendário"
        accessibilityLabel={`${label}: ${placeholder}`}
        accessibilityRole="button"
        onPress={open}
        style={({ pressed }) => [
          inputStyles.box,
          styles.box,
          { backgroundColor: colors.surface, borderColor: colors.border },
          pressed && styles.pressed,
        ]}>
        <AppText color="secondary">{placeholder}</AppText>
        <Ionicons color={colors.textSecondary} name="calendar-outline" size={17} />
      </Pressable>
    </FormField>
  );
}

const optionalStyles = StyleSheet.create({
  clear: {
    position: 'absolute',
    right: 40,
    // Vertically centered on the 46px input below the label.
    top: 36,
  },
});
