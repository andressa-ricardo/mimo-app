import { Inter_400Regular } from '@expo-google-fonts/inter/400Regular';
import { Inter_500Medium } from '@expo-google-fonts/inter/500Medium';
import { Inter_600SemiBold } from '@expo-google-fonts/inter/600SemiBold';
import { Inter_700Bold } from '@expo-google-fonts/inter/700Bold';
import { useFonts } from 'expo-font';
import { Stack } from 'expo-router';
import * as SplashScreen from 'expo-splash-screen';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';
import { ActivityIndicator, StyleSheet, Text, View } from 'react-native';

import { useAppBootstrap } from '@/hooks/use-app-bootstrap';
import { AppThemeProvider, useAppTheme } from '@/theme/theme-provider';

void SplashScreen.preventAutoHideAsync();

function RootNavigator() {
  const { colors, isDark } = useAppTheme();

  return (
    <>
      <Stack
        screenOptions={{
          contentStyle: { backgroundColor: colors.background },
          headerShown: false,
        }}
      >
        <Stack.Screen name="index" />
        <Stack.Screen name="onboarding" />
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="notes" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="goals" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="calendar" options={{ animation: 'slide_from_right' }} />
        <Stack.Screen name="settings" options={{ animation: 'slide_from_right' }} />
      </Stack>
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const bootstrap = useAppBootstrap();
  const [fontsLoaded, fontError] = useFonts({
    Inter_400Regular,
    Inter_500Medium,
    Inter_600SemiBold,
    Inter_700Bold,
  });
  const isLoading = bootstrap.status === 'loading' || (!fontsLoaded && !fontError);

  useEffect(() => {
    if (!isLoading) void SplashScreen.hideAsync();
  }, [isLoading]);

  if (isLoading) {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#8973AD" />
      </View>
    );
  }

  if (bootstrap.status === 'error' || fontError) {
    return (
      <View style={styles.errorContainer}>
        <View style={styles.errorContent}>
          <ActivityIndicator color="#C94C4C" />
          <Text style={styles.errorText}>Não foi possível iniciar o Mimo.</Text>
        </View>
      </View>
    );
  }

  return (
    <AppThemeProvider
      initialPreferences={bootstrap.appearance}
      initialProfile={bootstrap.profile}>
      <RootNavigator />
    </AppThemeProvider>
  );
}

const styles = StyleSheet.create({
  errorContainer: {
    alignItems: 'center',
    backgroundColor: '#FAF9F7',
    flex: 1,
    justifyContent: 'center',
  },
  errorContent: {
    alignItems: 'center',
    gap: 12,
    padding: 24,
  },
  errorText: {
    color: '#25232A',
    fontSize: 15,
    textAlign: 'center',
  },
  loading: {
    alignItems: 'center',
    backgroundColor: '#FAF9F7',
    flex: 1,
    justifyContent: 'center',
  },
});
