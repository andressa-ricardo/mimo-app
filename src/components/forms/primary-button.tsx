import Ionicons from '@expo/vector-icons/Ionicons';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

type PrimaryButtonProps = {
  disabled?: boolean;
  icon?: keyof typeof Ionicons.glyphMap;
  label: string;
  loading?: boolean;
  onPress: () => void;
  /** Outlined variant for secondary actions. */
  variant?: 'filled' | 'outlined';
};

export function PrimaryButton({
  disabled = false,
  icon,
  label,
  loading = false,
  onPress,
  variant = 'filled',
}: PrimaryButtonProps) {
  const { colors } = useAppTheme();
  const inactive = disabled || loading;
  const outlined = variant === 'outlined';
  const contentColor = outlined ? colors.accent : colors.onAccent;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ busy: loading, disabled: inactive }}
      disabled={inactive}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        outlined
          ? { backgroundColor: colors.surface, borderColor: colors.accent, borderWidth: 1 }
          : { backgroundColor: colors.accent },
        inactive && styles.inactive,
        pressed && styles.pressed,
      ]}>
      {loading ? (
        <ActivityIndicator color={contentColor} />
      ) : (
        <>
          {icon ? <Ionicons color={contentColor} name={icon} size={17} /> : null}
          <AppText style={[styles.label, { color: contentColor }]}>{label}</AppText>
        </>
      )}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    justifyContent: 'center',
    minHeight: 48,
  },
  inactive: {
    opacity: 0.6,
  },
  label: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  pressed: {
    opacity: 0.82,
  },
});
