import Ionicons from '@expo/vector-icons/Ionicons';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { accentPalettes } from '@/theme/tokens';
import { useAppTheme } from '@/theme/theme-provider';
import type { AccentColor, ColorSchemePreference } from '@/types/preferences';

const accentOptions: { key: AccentColor; label: string }[] = [
  { key: 'lavender', label: 'Lavanda' },
  { key: 'blue', label: 'Azul' },
  { key: 'green', label: 'Verde' },
  { key: 'pink', label: 'Rosa' },
];

const appearanceOptions: {
  icon: keyof typeof Ionicons.glyphMap;
  key: ColorSchemePreference;
  label: string;
}[] = [
  { key: 'light', label: 'Claro', icon: 'sunny-outline' },
  { key: 'dark', label: 'Escuro', icon: 'moon-outline' },
  { key: 'system', label: 'Sistema', icon: 'phone-portrait-outline' },
];

type AppearanceControlsProps = {
  accentColor: AccentColor;
  colorScheme: ColorSchemePreference;
  onAccentChange: (accentColor: AccentColor) => void;
  onColorSchemeChange: (colorScheme: ColorSchemePreference) => void;
};

export function AppearanceControls({
  accentColor,
  colorScheme,
  onAccentChange,
  onColorSchemeChange,
}: AppearanceControlsProps) {
  const { colors } = useAppTheme();

  return (
    <View style={styles.container}>
      <View>
        <AppText variant="section">Deixe o Mimo com a sua cara.</AppText>
        <AppText color="secondary" style={styles.helper}>
          Escolha sua cor favorita. Você poderá mudar depois.
        </AppText>
      </View>

      <View style={styles.accentRow}>
        {accentOptions.map((option) => {
          const selected = accentColor === option.key;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={option.key}
              onPress={() => onAccentChange(option.key)}
              style={styles.accentOption}>
              <View
                style={[
                  styles.swatchRing,
                  { borderColor: selected ? colors.text : 'transparent' },
                ]}>
                <View
                  style={[styles.swatch, { backgroundColor: accentPalettes[option.key].primary }]}
                />
              </View>
              <AppText color={selected ? 'primary' : 'secondary'} variant="caption">
                {option.label}
              </AppText>
            </Pressable>
          );
        })}
      </View>

      <View>
        <AppText style={styles.appearanceTitle} variant="label">
          Aparência
        </AppText>
        <View style={styles.appearanceRow}>
          {appearanceOptions.map((option) => {
            const selected = colorScheme === option.key;
            return (
              <Pressable
                accessibilityRole="radio"
                accessibilityState={{ checked: selected }}
                key={option.key}
                onPress={() => onColorSchemeChange(option.key)}
                style={({ pressed }) => [
                  styles.appearanceOption,
                  {
                    backgroundColor: selected ? colors.accentSoft : colors.surface,
                    borderColor: selected ? colors.accent : colors.border,
                  },
                  pressed && styles.pressed,
                ]}>
                <Ionicons
                  color={selected ? colors.accent : colors.textSecondary}
                  name={option.icon}
                  size={19}
                />
                <AppText color={selected ? 'accent' : 'secondary'} variant="caption">
                  {option.label}
                </AppText>
              </Pressable>
            );
          })}
        </View>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  accentOption: {
    alignItems: 'center',
    flex: 1,
    gap: 6,
  },
  accentRow: {
    flexDirection: 'row',
    gap: 8,
  },
  appearanceOption: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    gap: 5,
    justifyContent: 'center',
    minHeight: 68,
  },
  appearanceRow: {
    flexDirection: 'row',
    gap: 8,
  },
  appearanceTitle: {
    marginBottom: 10,
  },
  container: {
    gap: 22,
  },
  helper: {
    marginTop: 5,
  },
  pressed: {
    opacity: 0.7,
  },
  swatch: {
    borderRadius: 22,
    height: 40,
    width: 40,
  },
  swatchRing: {
    alignItems: 'center',
    borderRadius: 26,
    borderWidth: 1.5,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
});
