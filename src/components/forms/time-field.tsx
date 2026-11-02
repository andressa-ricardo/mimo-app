import Ionicons from '@expo/vector-icons/Ionicons';
import DateTimePicker, { DateTimePickerAndroid } from '@react-native-community/datetimepicker';
import { Platform, Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { pickerFieldStyles } from '@/components/forms/date-field';
import { FormField, inputStyles } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';
import { nextFullHour, toTimeKey, type TimeKey } from '@/utils/date';

type TimeFieldProps = {
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
  onChange: (value: TimeKey | null) => void;
  value: TimeKey | null;
};

function timeToDate(value: TimeKey): Date {
  const [hours, minutes] = value.split(':').map(Number);
  const date = new Date();
  date.setHours(hours, minutes, 0, 0);
  return date;
}

/** Optional time: empty until chosen, with a clear button once set. */
export function TimeField({ containerStyle, label, onChange, value }: TimeFieldProps) {
  const { colors, isDark } = useAppTheme();

  const openPicker = () => {
    const initial = value ?? nextFullHour(new Date());
    if (Platform.OS === 'ios') {
      onChange(initial);
      return;
    }
    DateTimePickerAndroid.open({
      is24Hour: true,
      mode: 'time',
      value: timeToDate(initial),
      onValueChange: (_, selected) => onChange(toTimeKey(selected)),
    });
  };

  const clearButton = value ? (
    <Pressable accessibilityLabel="Remover horário" accessibilityRole="button" hitSlop={10} onPress={() => onChange(null)}>
      <Ionicons color={colors.textSecondary} name="close-circle" size={18} />
    </Pressable>
  ) : null;

  if (Platform.OS === 'ios' && value) {
    return (
      <FormField label={label} style={containerStyle}>
        <View
          style={[
            inputStyles.box,
            pickerFieldStyles.iosBox,
            styles.iosRow,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          <DateTimePicker
            accentColor={colors.accent}
            accessibilityLabel={label}
            display="compact"
            locale="pt-BR"
            mode="time"
            onValueChange={(_, selected) => onChange(toTimeKey(selected))}
            themeVariant={isDark ? 'dark' : 'light'}
            value={timeToDate(value)}
          />
          {clearButton}
        </View>
      </FormField>
    );
  }

  return (
    <FormField label={label} style={containerStyle}>
      <View style={[inputStyles.box, pickerFieldStyles.box, { backgroundColor: colors.surface, borderColor: colors.border }]}>
        <Pressable
          accessibilityHint="Abre o seletor de horário"
          accessibilityLabel={`${label}: ${value ?? 'sem horário'}`}
          accessibilityRole="button"
          onPress={openPicker}
          style={({ pressed }) => [styles.trigger, pressed && pickerFieldStyles.pressed]}>
          <AppText color={value ? 'primary' : 'secondary'}>{value ?? '--:--'}</AppText>
          {value ? null : <Ionicons color={colors.textSecondary} name="time-outline" size={17} />}
        </Pressable>
        {clearButton}
      </View>
    </FormField>
  );
}

const styles = StyleSheet.create({
  iosRow: {
    justifyContent: 'space-between',
    paddingRight: 12,
  },
  trigger: {
    alignItems: 'center',
    alignSelf: 'stretch',
    flex: 1,
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
});
