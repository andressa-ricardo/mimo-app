import Ionicons from '@expo/vector-icons/Ionicons';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { FilterChip } from '@/components/ui/filter-chip';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { GoalCard } from '@/features/goals/components/goal-card';
import { GoalSheet } from '@/features/goals/components/goal-sheet';
import { useGoals } from '@/features/goals/use-goals';
import { useAppTheme } from '@/theme/theme-provider';
import type { GoalStatus } from '@/types/goals';
import { formatCurrency } from '@/utils/format';

type Filter = 'all' | GoalStatus;

const filters: { value: Filter; label: string }[] = [
  { value: 'all', label: 'Todas' },
  { value: 'active', label: 'Em andamento' },
  { value: 'completed', label: 'Concluídas' },
  { value: 'archived', label: 'Arquivadas' },
];

const emptyMessages: Record<Filter, string> = {
  all: 'Nenhuma meta ainda.',
  active: 'Nenhuma meta em andamento.',
  completed: 'Nenhuma meta concluída ainda — cada aporte conta!',
  archived: 'Nenhuma meta arquivada.',
};

export function GoalsScreen() {
  const { colors } = useAppTheme();
  const state = useGoals();
  const [filter, setFilter] = useState<Filter>('all');
  const [creating, setCreating] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const hideToast = useCallback(() => setToast(null), []);
  const closeCreate = useCallback(() => setCreating(false), []);
  const handleCreated = useCallback((text: string) => {
    setCreating(false);
    setToast({ id: Date.now(), text });
  }, []);

  const goals = state.data ?? [];
  // Archived goals are kept out of the totals; each goal is summed once.
  const visibleInSummary = goals.filter((goal) => goal.status !== 'archived');
  const savedCents = visibleInSummary.reduce((total, goal) => total + Math.max(goal.savedAmountCents, 0), 0);
  const targetCents = visibleInSummary.reduce((total, goal) => total + goal.targetAmountCents, 0);
  const activeCount = goals.filter((goal) => goal.status === 'active').length;
  const completedCount = goals.filter((goal) => goal.status === 'completed').length;
  // "Todas" shows every goal, with archived ones at the end.
  const listed = goals
    .filter((goal) => filter === 'all' || goal.status === filter)
    .sort((a, b) => Number(a.status === 'archived') - Number(b.status === 'archived'));

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Pressable
          accessibilityLabel="Voltar"
          accessibilityRole="button"
          hitSlop={10}
          onPress={() => router.back()}
          style={({ pressed }) => [styles.back, pressed && styles.pressed]}>
          <Ionicons color={colors.text} name="chevron-back" size={22} />
        </Pressable>

        <View style={styles.header}>
          <View style={styles.flex}>
            <AppText variant="title">Minhas metas</AppText>
            <AppText color="secondary" variant="caption">
              Um pouquinho de cada vez, você chega lá.
            </AppText>
          </View>
          <Pressable
            accessibilityRole="button"
            onPress={() => setCreating(true)}
            style={({ pressed }) => [styles.newButton, { backgroundColor: colors.accent }, pressed && styles.pressed]}>
            <AppText style={[styles.newLabel, { color: colors.onAccent }]} variant="label">
              + Nova meta
            </AppText>
          </Pressable>
        </View>

        {goals.length > 0 ? (
          <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText color="secondary" variant="caption">
              Guardado nas metas
            </AppText>
            <AppText style={styles.summaryAmount}>
              {formatCurrency(savedCents)}{' '}
              <AppText color="secondary" variant="label">
                de {formatCurrency(targetCents)}
              </AppText>
            </AppText>
            <AppText color="secondary" variant="caption">
              {activeCount} em andamento · {completedCount} {completedCount === 1 ? 'concluída' : 'concluídas'}
            </AppText>
          </View>
        ) : null}

        <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false}>
          {filters.map((option) => (
            <FilterChip
              key={option.value}
              label={option.label}
              onPress={() => setFilter(option.value)}
              selected={filter === option.value}
            />
          ))}
        </ScrollView>

        {state.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} style={styles.message} />
        ) : state.status === 'error' ? (
          <AppText color="secondary" style={styles.message}>
            Não foi possível carregar suas metas.
          </AppText>
        ) : listed.length === 0 ? (
          <View style={[styles.empty, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
              <Ionicons color={colors.accent} name="flag-outline" size={22} />
            </View>
            <AppText color="secondary" style={styles.center}>
              {emptyMessages[filter]}
            </AppText>
            {goals.length === 0 ? (
              <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setCreating(true)}>
                <AppText color="accent" variant="label">
                  Criar minha primeira meta
                </AppText>
              </Pressable>
            ) : null}
          </View>
        ) : (
          listed.map((goal) => (
            <GoalCard
              goal={goal}
              key={goal.id}
              onPress={() => router.push({ pathname: '/goals/[id]', params: { id: goal.id } })}
            />
          ))
        )}
      </ScrollView>

      <Toast message={toast} onHide={hideToast} />
      <GoalSheet onClose={closeCreate} onSaved={handleCreated} visible={creating} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  back: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    marginLeft: -8,
    width: 40,
  },
  center: {
    textAlign: 'center',
  },
  chips: {
    gap: 7,
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 560,
    paddingBottom: 32,
    paddingHorizontal: 16,
    paddingTop: 4,
    width: '100%',
  },
  empty: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 22,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  message: {
    marginTop: 32,
    textAlign: 'center',
  },
  newButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 38,
    paddingHorizontal: 14,
  },
  newLabel: {
    fontFamily: 'Inter_600SemiBold',
  },
  pressed: {
    opacity: 0.7,
  },
  screen: {
    flex: 1,
  },
  summary: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 16,
  },
  summaryAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 30,
  },
});
