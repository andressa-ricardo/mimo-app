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
      />
      <StatusBar style={isDark ? 'light' : 'dark'} />
    </>
  );
}

export default function RootLayout() {
  const bootstrap = useAppBootstrap();

  useEffect(() => {
    if (bootstrap.status !== 'loading') void SplashScreen.hideAsync();
  }, [bootstrap.status]);

  if (bootstrap.status === 'loading') {
    return (
      <View style={styles.loading}>
        <ActivityIndicator color="#8973AD" />
      </View>
    );
  }

  if (bootstrap.status === 'error') {
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
    <AppThemeProvider initialPreferences={bootstrap.preferences}>
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
