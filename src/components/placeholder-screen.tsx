import Ionicons from '@expo/vector-icons/Ionicons';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { ScreenHeader } from '@/components/ui/screen-header';
import { useAppTheme } from '@/theme/theme-provider';

type PlaceholderScreenProps = {
  icon: keyof typeof Ionicons.glyphMap;
  message: string;
  secondary?: boolean;
  title: string;
};

export function PlaceholderScreen({ icon, message, secondary = false, title }: PlaceholderScreenProps) {
  const { colors } = useAppTheme();

  const content = (
    <View style={styles.content}>
      <View style={[styles.icon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons color={colors.accent} name={icon} size={26} />
      </View>
      <AppText style={styles.title} variant="subtitle">
        {title}
      </AppText>
      <AppText color="secondary" style={styles.message}>
        {message}
      </AppText>
    </View>
  );

  if (secondary) {
    return (
      <View style={[styles.screen, { backgroundColor: colors.background }]}>
        <ScreenHeader title={title} />
        {content}
      </View>
    );
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      {content}
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  content: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 32,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  message: {
    marginTop: 8,
    maxWidth: 280,
    textAlign: 'center',
  },
  screen: {
    flex: 1,
  },
  title: {
    marginTop: 16,
    textAlign: 'center',
  },
});
