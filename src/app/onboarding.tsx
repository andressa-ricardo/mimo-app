import Ionicons from "@expo/vector-icons/Ionicons";
import { Image } from "expo-image";
import { Redirect, router } from "expo-router";
import { useState } from "react";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";

import { AppText } from "@/components/ui/app-text";
import { AppearanceControls } from "@/features/settings/components/appearance-controls";
import { useAppTheme } from "@/theme/theme-provider";
import type { AccentColor, ColorSchemePreference } from "@/types/preferences";

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

  if (profile.onboardingCompleted) return <Redirect href="/(tabs)" />;

  async function handleComplete() {
    if (!normalizedName || isSaving) return;
    setIsSaving(true);
    setErrorMessage(null);

    try {
      await updatePreferences(preferences);
      await completeOnboarding(normalizedName);
      router.replace("/(tabs)");
    } catch {
      setErrorMessage(
        "Não foi possível salvar suas preferências. Tente novamente.",
      );
      setIsSaving(false);
    }
  }

  async function updateAppearance(
    change: Partial<{
      accentColor: AccentColor;
      colorScheme: ColorSchemePreference;
    }>,
  ) {
    setErrorMessage(null);
    try {
      await updatePreferences(change);
    } catch {
      setErrorMessage("Não foi possível salvar a aparência. Tente novamente.");
    }
  }

  return (
    <KeyboardAvoidingView
      behavior={Platform.OS === "ios" ? "padding" : undefined}
      style={[styles.flex, { backgroundColor: colors.background }]}
    >
      <SafeAreaView style={styles.flex}>
        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          <View style={styles.brandBlock}>
            <Image
              accessibilityLabel="mimo."
              contentFit="contain"
              source={require("@/assets/logo.png")}
              style={styles.logoImage}
            />
          </View>

          <View style={styles.formContent}>
            <View>
              <AppText style={styles.introTitle} variant="subtitle">
                Seu espaço para tudo o que importa.
              </AppText>
              <AppText color="secondary" style={styles.introText} variant="caption">
                Organize seus planos, finanças e pequenas conquistas em um só
                lugar.
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
              onAccentChange={(accentColor) =>
                void updateAppearance({ accentColor })
              }
              onColorSchemeChange={(colorScheme) =>
                void updateAppearance({ colorScheme })
              }
            />

            <View
              style={[styles.preview, { backgroundColor: colors.accentSoft }]}
            >
              <View style={styles.previewCopy}>
                <AppText color="accent" variant="caption">
                  UMA PRÉVIA DO SEU MIMO
                </AppText>
                <AppText style={styles.previewGreeting} variant="section">
                  Olá{normalizedName ? `, ${normalizedName}` : ""} ✦
                </AppText>
              </View>
              <View
                style={[
                  styles.previewAvatar,
                  { backgroundColor: colors.accent },
                ]}
              >
                <AppText style={{ color: colors.onAccent }} variant="label">
                  {normalizedName.charAt(0).toUpperCase() || "M"}
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
              ]}
            >
              {isSaving ? (
                <ActivityIndicator color={colors.onAccent} />
              ) : (
                <>
                  <AppText style={{ color: colors.onAccent }} variant="label">
                    Começar
                  </AppText>
                  <Ionicons
                    color={colors.onAccent}
                    name="arrow-forward"
                    size={17}
                  />
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
    alignItems: "center",
    marginBottom: 12,
  },
  formContent: {
    gap: 18,
  },
  content: {
    alignSelf: "center",
    flexGrow: 1,
    maxWidth: 520,
    paddingHorizontal: 20,
    paddingBottom: 20,
    paddingTop: 8,
    width: "100%",
  },
  disabled: {
    opacity: 0.45,
  },
  fieldLabel: {
    marginBottom: 5,
  },
  flex: {
    flex: 1,
  },
  input: {
    borderRadius: 14,
    borderWidth: 1,
    fontFamily: "Inter_400Regular",
    fontSize: 14,
    height: 44,
    paddingHorizontal: 15,
  },
  introText: {
    lineHeight: 17,
    marginTop: 3,
  },
  introTitle: {
    fontSize: 18,
    lineHeight: 23,
  },
  logoImage: {
    aspectRatio: 16 / 9,
    width: 100,
  },
  pressed: {
    opacity: 0.78,
  },
  preview: {
    alignItems: "center",
    borderRadius: 18,
    flexDirection: "row",
    padding: 11,
  },
  previewAvatar: {
    alignItems: "center",
    borderRadius: 18,
    height: 32,
    justifyContent: "center",
    width: 32,
  },
  previewCopy: {
    flex: 1,
  },
  previewGreeting: {
    marginTop: 3,
  },
  startButton: {
    alignItems: "center",
    borderRadius: 15,
    flexDirection: "row",
    gap: 8,
    height: 46,
    justifyContent: "center",
  },
});
