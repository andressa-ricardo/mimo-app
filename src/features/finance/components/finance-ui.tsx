import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';
import { parseDateKey, type DateKey } from '@/utils/date';

export function SectionHeader({
  actionLabel,
  onAction,
  title,
}: {
  actionLabel?: string;
  onAction?: () => void;
  title: string;
}) {
  return (
    <View style={styles.sectionHeader}>
      <AppText accessibilityRole="header" variant="section">
        {title}
      </AppText>
      {actionLabel && onAction ? (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAction}>
          <AppText color="accent" variant="label">
            {actionLabel}
          </AppText>
        </Pressable>
      ) : null}
    </View>
  );
}

export function Card({ children, style }: { children: ReactNode; style?: StyleProp<ViewStyle> }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }, style]}>{children}</View>
  );
}

export function EmptyNote({ children }: { children: string }) {
  return (
    <Card style={styles.emptyCard}>
      <AppText color="secondary" style={styles.emptyText} variant="caption">
        {children}
      </AppText>
    </Card>
  );
}

/** Thin progress track; `fraction` is clamped to 0–1 for the geometry only. */
export function ProgressBar({ color, fraction }: { color: string; fraction: number }) {
  const { colors } = useAppTheme();
  const clamped = Math.min(Math.max(fraction, 0), 1);
  return (
    <View style={[styles.track, { backgroundColor: colors.muted }]}>
      <View style={[styles.fill, { backgroundColor: color, width: `${clamped * 100}%` }]} />
    </View>
  );
}

export function capitalize(text: string): string {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

const shortDate = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

export function formatShortDate(key: DateKey): string {
  return shortDate.format(parseDateKey(key));
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
  },
  emptyCard: {
    padding: 16,
  },
  emptyText: {
    textAlign: 'center',
  },
  fill: {
    borderRadius: 4,
    height: 7,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  track: {
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
});
