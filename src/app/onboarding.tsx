import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, router } from 'expo-router';
import { useState } from 'react';
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { AppearanceControls } from '@/features/settings/components/appearance-controls';
import { useAppTheme } from '@/theme/theme-provider';
import type { AccentColor, ColorSchemePreference } from '@/types/preferences';

export default function OnboardingScreen() {
  const {
    colors,
    completeOnboarding,
    preferences,
    profile,
    updatePreferences,
  } = useAppTheme();
  const [name, setName] = useState(profile.preferredName);
  const [isSaving, setIsSaving] = useState(false);
  const [isNameFocused, setIsNameFocused] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const normalizedName = name.trim();

  if (profile.onboardingCompleted) return <Redirect href="/(tabs)/index" />;

  async function handleComplete() {
    if (!normalizedName || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updatePreferences(preferences);
      await completeOnboarding(normalizedName);
      router.replace('/(tabs)/index');
    } catch {
      setErrorMessage('Não foi possível salvar suas preferências. Tente novamente.');
      setIsSaving(false);
    }
  }

  async function updateAppearance(
    change: Partial<{ accentColor: AccentColor; colorScheme: ColorSchemePreference }>,
  ) {
    setErrorMessage(null);
    try {
      await updatePreferences(change);
    } catch {
      setErrorMessage('Não foi possível salvar a aparência. Tente novamente.');
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      style={[styles.flex, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}>
          <View style={styles.brandBlock}>
            <View style={[styles.logoMark, { backgroundColor: colors.accentSoft }]}>
              <Ionicons color={colors.accent} name="sparkles" size={22} />
            </View>
            <AppText style={styles.logo}>mimo.</AppText>
            <AppText color="secondary" style={styles.tagline} variant="label">
              a little space for everything.
            </AppText>
          </View>

          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View>
              <AppText variant="subtitle">Seu espaço para tudo o que importa.</AppText>
              <AppText color="secondary" style={styles.introText}>
                Organize seus planos, finanças e pequenas conquistas em um só lugar.
              </AppText>
            </View>

            <View>
              <AppText style={styles.fieldLabel} variant="label">
                Como podemos te chamar?
              </AppText>
              <TextInput
                autoCapitalize="words"
                autoComplete="name"
                maxLength={40}
                onChangeText={setName}
                onBlur={() => setIsNameFocused(false)}
                onFocus={() => setIsNameFocused(true)}
                placeholder="Seu nome"
                placeholderTextColor={colors.textSecondary}
                returnKeyType="done"
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
            </View>

            <AppearanceControls
              accentColor={preferences.accentColor}
              colorScheme={preferences.colorScheme}
              onAccentChange={(accentColor) => void updateAppearance({ accentColor })}
              onColorSchemeChange={(colorScheme) => void updateAppearance({ colorScheme })}
            />

            <View style={[styles.preview, { backgroundColor: colors.accentSoft }]}>
              <View style={styles.previewCopy}>
                <AppText color="accent" variant="caption">
                  UMA PRÉVIA DO SEU MIMO
                </AppText>
                <AppText style={styles.previewGreeting} variant="section">
                  Olá{normalizedName ? `, ${normalizedName}` : ''} ✦
                </AppText>
              </View>
              <View style={[styles.previewAvatar, { backgroundColor: colors.accent }]}>
                <AppText style={{ color: colors.onAccent }} variant="label">
                  {normalizedName.charAt(0).toUpperCase() || 'M'}
                </AppText>
              </View>
            </View>

            {errorMessage ? (
              <AppText style={{ color: colors.error }} variant="caption">
                {errorMessage}
              </AppText>
            ) : null}

            <Pressable
              accessibilityRole="button"
              disabled={!normalizedName || isSaving}
              onPress={() => void handleComplete()}
              style={({ pressed }) => [
                styles.startButton,
                { backgroundColor: colors.accent },
                (!normalizedName || isSaving) && styles.disabled,
                pressed && styles.pressed,
              ]}>
              {isSaving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <AppText style={{ color: colors.onAccent }} variant="label">
                    Começar
                  </AppText>
                  <Ionicons color={colors.onAccent} name="arrow-forward" size={17} />
                </>
              )}
            </Pressable>
          </View>
        </ScrollView>
      </SafeAreaView>
    </KeyboardAvoidingView>
  );
}

const styles = StyleSheet.create({
  brandBlock: {
    alignItems: 'center',
    marginBottom: 24,
  },
  card: {
    borderRadius: 28,
    borderWidth: 1,
    gap: 26,
    padding: 22,
  },
  content: {
    alignSelf: 'center',
    maxWidth: 520,
    padding: 20,
    paddingBottom: 36,
    width: '100%',
  },
  disabled: {
    opacity: 0.45,
  },
  fieldLabel: {
    marginBottom: 9,
  },
  flex: {
    flex: 1,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 15,
    height: 50,
    paddingHorizontal: 15,
  },
  introText: {
    marginTop: 7,
  },
  logo: {
    fontFamily: 'Inter_700Bold',
    fontSize: 34,
    letterSpacing: -1.3,
    marginTop: 9,
  },
  logoMark: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  pressed: {
    opacity: 0.78,
  },
  preview: {
    alignItems: 'center',
    borderRadius: 18,
    flexDirection: 'row',
    padding: 15,
  },
  previewAvatar: {
    alignItems: 'center',
    borderRadius: 18,
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  previewCopy: {
    flex: 1,
  },
  previewGreeting: {
    marginTop: 3,
  },
  startButton: {
    alignItems: 'center',
    borderRadius: 15,
    flexDirection: 'row',
    gap: 8,
    height: 52,
    justifyContent: 'center',
  },
  tagline: {
    marginTop: 2,
  },
});
