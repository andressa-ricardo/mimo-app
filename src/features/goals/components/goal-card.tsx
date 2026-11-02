import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { goalProgress, goalStatusLabels } from '@/features/goals/goal-math';
import { useAppTheme } from '@/theme/theme-provider';
import type { Goal } from '@/types/goals';
import { formatDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

export function GoalProgressBar({ fraction }: { fraction: number }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.track, { backgroundColor: colors.accentSoft }]}>
      <View style={[styles.fill, { backgroundColor: colors.accent, width: `${Math.min(fraction, 1) * 100}%` }]} />
    </View>
  );
}

export function GoalStatusPill({ goal }: { goal: Goal }) {
  const { colors } = useAppTheme();
  if (goal.status === 'active') return null;
  const completed = goal.status === 'completed';
  return (
    <View style={[styles.pill, { backgroundColor: completed ? `${colors.success}1F` : colors.muted }]}>
      <AppText style={completed ? { color: colors.success } : undefined} color="secondary" variant="caption">
        {completed ? '✓ ' : ''}
        {goalStatusLabels[goal.status]}
      </AppText>
    </View>
  );
}

export function describeRemaining(goal: Goal): string {
  const progress = goalProgress(goal.savedAmountCents, goal.targetAmountCents);
  if (progress.remainingCents > 0) return `Faltam ${formatCurrency(progress.remainingCents)}`;
  return progress.surplusCents > 0 ? `${formatCurrency(progress.surplusCents)} além da meta` : 'Meta atingida 🎉';
}

export function GoalCard({ goal, onPress }: { goal: Goal; onPress: () => void }) {
  const { colors } = useAppTheme();
  const progress = goalProgress(goal.savedAmountCents, goal.targetAmountCents);
  const archived = goal.status === 'archived';

  return (
    <Pressable
      accessibilityHint="Abre os detalhes da meta"
      accessibilityLabel={`${goal.title}: ${formatCurrency(goal.savedAmountCents)} de ${formatCurrency(goal.targetAmountCents)}, ${progress.percent}%`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.card,
        { backgroundColor: colors.surface, borderColor: colors.border },
        archived && styles.archived,
        pressed && styles.pressed,
      ]}>
      <View style={styles.heading}>
        <AppText numberOfLines={1} style={styles.title}>
          {goal.icon ? `${goal.icon}  ` : ''}
          {goal.title}
        </AppText>
        <GoalStatusPill goal={goal} />
      </View>
      <AppText color="secondary" variant="caption">
        {formatCurrency(goal.savedAmountCents)} de {formatCurrency(goal.targetAmountCents)}
        {goal.targetDate ? ` · até ${formatDateKey(goal.targetDate)}` : ''}
      </AppText>
      <GoalProgressBar fraction={progress.fraction} />
      <View style={styles.footer}>
        <AppText variant="caption">{progress.percent}% concluído</AppText>
        <AppText color="secondary" variant="caption">
          {describeRemaining(goal)}
        </AppText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  archived: {
    opacity: 0.7,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 8,
    padding: 16,
  },
  fill: {
    borderRadius: 4,
    height: 7,
  },
  footer: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pill: {
    borderRadius: 10,
    paddingHorizontal: 8,
    paddingVertical: 2,
  },
  pressed: {
    opacity: 0.75,
  },
  title: {
    flex: 1,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  track: {
    borderRadius: 4,
    height: 7,
    overflow: 'hidden',
  },
});
