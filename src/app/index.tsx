import { StyleSheet, Text, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme-provider';

export default function HomeScreen() {
  const { colors } = useAppTheme();

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <SafeAreaView style={styles.safeArea}>
        <Text style={[styles.brand, { color: colors.text }]}>mimo.</Text>
        <Text style={[styles.subtitle, { color: colors.textSecondary }]}>Seu espaço para tudo.</Text>
      </SafeAreaView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
  },
  safeArea: {
    alignItems: 'center',
    gap: 8,
    justifyContent: 'center',
  },
  brand: {
    fontSize: 42,
    fontWeight: '700',
    letterSpacing: -1.5,
  },
  subtitle: {
    fontSize: 15,
    letterSpacing: 0.1,
  },
});
