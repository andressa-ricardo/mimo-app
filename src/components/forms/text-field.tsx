import { useState, type ReactNode } from 'react';
import { StyleSheet, TextInput, View, type StyleProp, type TextInputProps, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

type FormFieldProps = {
  children: ReactNode;
  error?: string | null;
  helper?: string | null;
  label?: string;
  style?: StyleProp<ViewStyle>;
};

/** Label + control + helper/error line shared by every form field. */
export function FormField({ children, error, helper, label, style }: FormFieldProps) {
  const { colors } = useAppTheme();
  const message = error ?? helper;

  return (
    <View style={[styles.field, style]}>
      {label ? (
        <AppText color="secondary" variant="label">
          {label}
        </AppText>
      ) : null}
      {children}
      {message ? (
        <AppText
          accessibilityLiveRegion={error ? 'polite' : 'none'}
          color="secondary"
          style={error ? { color: colors.error } : undefined}
          variant="caption">
          {message}
        </AppText>
      ) : null}
    </View>
  );
}

export function useInputBorderColor(focused: boolean, hasError: boolean): string {
  const { colors } = useAppTheme();
  if (hasError) return colors.error;
  return focused ? colors.accent : colors.border;
}

export type TextFieldProps = Omit<TextInputProps, 'style'> & {
  containerStyle?: StyleProp<ViewStyle>;
  error?: string | null;
  helper?: string | null;
  label?: string;
  large?: boolean;
  textColor?: string;
};

export function TextField({
  containerStyle,
  error,
  helper,
  label,
  large = false,
  multiline,
  onBlur,
  onFocus,
  textColor,
  ...props
}: TextFieldProps) {
  const { colors } = useAppTheme();
  const [focused, setFocused] = useState(false);
  const borderColor = useInputBorderColor(focused, Boolean(error));

  return (
    <FormField error={error} helper={helper} label={label} style={containerStyle}>
      <TextInput
        accessibilityLabel={label}
        multiline={multiline}
        onBlur={(event) => {
          setFocused(false);
          onBlur?.(event);
        }}
        onFocus={(event) => {
          setFocused(true);
          onFocus?.(event);
        }}
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={[
          styles.input,
          large && styles.large,
          multiline && styles.multiline,
          { backgroundColor: colors.surface, borderColor, color: textColor ?? colors.text },
        ]}
        textAlignVertical={multiline ? 'top' : 'center'}
        {...props}
      />
    </FormField>
  );
}

export const inputStyles = StyleSheet.create({
  box: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 46,
    paddingHorizontal: 14,
  },
});

const styles = StyleSheet.create({
  field: {
    gap: 7,
  },
  input: {
    borderRadius: 13,
    borderWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    minHeight: 46,
    paddingHorizontal: 14,
    paddingVertical: 11,
  },
  large: {
    fontFamily: 'Inter_500Medium',
    fontSize: 20,
    minHeight: 54,
  },
  multiline: {
    minHeight: 86,
  },
});
