import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { AppearanceControls } from '@/features/settings/components/appearance-controls';
import { useAppTheme } from '@/theme/theme-provider';
import type { AccentColor, ColorSchemePreference } from '@/types/preferences';

export default function SettingsScreen() {
  const { colors, preferences, profile, setPreferredName, updatePreferences } = useAppTheme();
  const [name, setName] = useState(profile.preferredName);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [isSaving, setIsSaving] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const normalizedName = name.trim();

  async function updateAppearance(
    change: Partial<{ accentColor: AccentColor; colorScheme: ColorSchemePreference }>,
  ) {
    setFeedback(null);
    try {
      await updatePreferences(change);
    } catch {
      setFeedback('Não foi possível salvar a aparência.');
    }
  }

  async function saveName() {
    if (!normalizedName || isSaving) return;
    setIsSaving(true);
    setFeedback(null);
    try {
      await setPreferredName(normalizedName);
      setName(normalizedName);
      setFeedback('Nome atualizado.');
    } catch {
      setFeedback('Não foi possível salvar seu nome.');
    } finally {
      setIsSaving(false);
    }
  }

  return (
    <View style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScreenHeader title="Ajustes" />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText variant="section">Como podemos te chamar?</AppText>
          <AppText color="secondary" style={styles.helper}>
            Este nome aparece na saudação da Home.
          </AppText>
          <TextInput
            autoCapitalize="words"
            maxLength={40}
            onChangeText={setName}
            onBlur={() => setIsNameFocused(false)}
            onFocus={() => setIsNameFocused(true)}
            placeholder="Seu nome"
            placeholderTextColor={colors.textSecondary}
            style={[
              styles.input,
              {
                backgroundColor: colors.background,
                borderColor: isNameFocused ? colors.accent : colors.border,
                color: colors.text,
              },
            ]}
            value={name}
          />
          <Pressable
            accessibilityRole="button"
            disabled={!normalizedName || isSaving}
            onPress={() => void saveName()}
            style={({ pressed }) => [
              styles.saveButton,
              { backgroundColor: colors.accent },
              (!normalizedName || isSaving) && styles.disabled,
              pressed && styles.pressed,
            ]}>
            <AppText style={{ color: colors.onAccent }} variant="label">
              {isSaving ? 'Salvando…' : 'Salvar nome'}
            </AppText>
          </Pressable>
        </View>

        <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppearanceControls
            accentColor={preferences.accentColor}
            colorScheme={preferences.colorScheme}
            onAccentChange={(accentColor) => void updateAppearance({ accentColor })}
            onColorSchemeChange={(colorScheme) => void updateAppearance({ colorScheme })}
          />
        </View>

        {feedback ? (
          <AppText color="secondary" style={styles.feedback} variant="caption">
            {feedback}
          </AppText>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 22,
    borderWidth: 1,
    padding: 20,
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 560,
    padding: 16,
    paddingBottom: 40,
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  feedback: {
    textAlign: 'center',
  },
  helper: {
    marginBottom: 14,
    marginTop: 4,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    height: 50,
    paddingHorizontal: 15,
  },
  pressed: {
    opacity: 0.75,
  },
  saveButton: {
    alignItems: 'center',
    alignSelf: 'flex-start',
    borderRadius: 12,
    justifyContent: 'center',
    marginTop: 12,
    minHeight: 42,
    paddingHorizontal: 18,
  },
  screen: {
    flex: 1,
  },
});
