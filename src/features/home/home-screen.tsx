import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type Href, router, useFocusEffect } from 'expo-router';
import { useCallback, useEffect, useRef, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { getTask } from '@/database/repositories/tasks-repository';
import type {
  HomeGoal,
  HomePlan,
  HomeTask,
  HomeWishlistItem,
} from '@/features/home/home-types';
import { useHomeSummary } from '@/features/home/use-home-summary';
import { TaskQuickSheet } from '@/features/quick-actions/task-quick-sheet';
import { TransactionQuickSheet } from '@/features/quick-actions/transaction-quick-sheet';
import { WishlistQuickSheet } from '@/features/quick-actions/wishlist-quick-sheet';
import { toggleTaskCompleted } from '@/features/tasks/create-task';
import { useAppTheme } from '@/theme/theme-provider';
import type { TaskItem } from '@/types/tasks';
import { formatCurrency, formatHomeDate, getGreeting, getLateNightMessage } from '@/utils/format';

type SectionHeaderProps = {
  href: Href;
  title: string;
};

function SectionHeader({ href, title }: SectionHeaderProps) {
  return (
    <View style={styles.sectionHeader}>
      <AppText variant="section">{title}</AppText>
      <Pressable hitSlop={8} onPress={() => router.push(href)}>
        <AppText color="accent" variant="caption">
          Ver tudo
        </AppText>
      </Pressable>
    </View>
  );
}

function EmptyState({ icon, message }: { icon: keyof typeof Ionicons.glyphMap; message: string }) {
  const { colors } = useAppTheme();
  return (
    <View style={[styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons color={colors.accent} name={icon} size={18} />
      </View>
      <AppText color="secondary" style={styles.emptyMessage} variant="caption">
        {message}
      </AppText>
    </View>
  );
}

type QuickActionSheet = 'task' | 'transaction' | 'wishlist';

function QuickActions({ onOpen }: { onOpen: (sheet: QuickActionSheet) => void }) {
  const { colors } = useAppTheme();
  const actions: { sheet: QuickActionSheet; label: string; accessibilityLabel: string }[] = [
    { label: 'Tarefa', sheet: 'task', accessibilityLabel: 'Nova tarefa' },
    { label: 'Gasto', sheet: 'transaction', accessibilityLabel: 'Nova transação' },
    { label: 'Desejo', sheet: 'wishlist', accessibilityLabel: 'Novo desejo' },
  ];

  return (
    <View style={styles.quickActions}>
      {actions.map((action) => (
        <Pressable
          accessibilityLabel={action.accessibilityLabel}
          accessibilityRole="button"
          key={action.label}
          onPress={() => onOpen(action.sheet)}
          style={({ pressed }) => [
            styles.quickAction,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <Ionicons color={colors.accent} name="add" size={17} />
          <AppText variant="label">{action.label}</AppText>
        </Pressable>
      ))}
    </View>
  );
}

function FinanceCard({ budgetCents, expenseCents }: { budgetCents: number | null; expenseCents: number }) {
  const { colors } = useAppTheme();
  const hasBudget = budgetCents !== null && budgetCents > 0;
  const progress = hasBudget ? Math.min(expenseCents / budgetCents, 1) : 0;
  const remaining = hasBudget ? Math.max(budgetCents - expenseCents, 0) : null;

  return (
    <View style={[styles.financeCard, { backgroundColor: colors.accent }]}>
      <AppText style={[styles.onAccentMuted, { color: colors.onAccent }]} variant="label">
        Gastos deste mês
      </AppText>
      <AppText style={[styles.financeAmount, { color: colors.onAccent }]}>
        {formatCurrency(expenseCents)}
      </AppText>
      <View style={[styles.progressTrack, { backgroundColor: colors.overlay }]}>
        <View
          style={[
            styles.progressFill,
            { backgroundColor: colors.onAccent, width: `${progress * 100}%` },
          ]}
        />
      </View>
      <View style={styles.financeFooter}>
        <AppText style={{ color: colors.onAccent }} variant="caption">
          {hasBudget ? `${Math.round(progress * 100)}% do orçamento` : 'Sem orçamento configurado'}
        </AppText>
        {remaining !== null ? (
          <AppText style={{ color: colors.onAccent }} variant="caption">
            Saldo {formatCurrency(remaining)}
          </AppText>
        ) : null}
      </View>
    </View>
  );
}

function SecondaryShortcuts() {
  const { colors } = useAppTheme();
  const shortcuts: {
    href: Href;
    icon: keyof typeof Ionicons.glyphMap;
    label: string;
  }[] = [
    { label: 'Metas', icon: 'disc-outline', href: '/goals' },
    { label: 'Calendário', icon: 'calendar-outline', href: '/calendar' },
  ];

  return (
    <View style={styles.shortcutRow}>
      {shortcuts.map((shortcut) => (
        <Pressable
          key={shortcut.label}
          onPress={() => router.push(shortcut.href)}
          style={({ pressed }) => [
            styles.shortcut,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <Ionicons color={colors.accent} name={shortcut.icon} size={20} />
          <AppText color="secondary" style={styles.shortcutLabel} variant="caption">
            {shortcut.label}
          </AppText>
        </Pressable>
      ))}
    </View>
  );
}

type HomeTaskEntry = { task: HomeTask; done: boolean };

type TaskListProps = {
  entries: HomeTaskEntry[];
  onEdit: (task: HomeTask) => void;
  onToggle: (entry: HomeTaskEntry, index: number) => void;
};

function TaskList({ entries, onEdit, onToggle }: TaskListProps) {
  const { colors } = useAppTheme();
  if (entries.length === 0) {
    return <EmptyState icon="checkmark-circle-outline" message="Nenhuma tarefa próxima por aqui." />;
  }

  return (
    <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {entries.map(({ task, done }, index) => {
        const statusColor = task.isOverdue
          ? colors.error
          : task.priority === 'high'
            ? colors.error
            : task.priority === 'medium'
              ? colors.warning
              : colors.info;
        return (
          <Pressable
            accessibilityHint="Abre a edição da tarefa"
            accessibilityLabel={done ? `${task.title}, concluída` : task.title}
            accessibilityRole="button"
            key={task.id}
            onPress={() => onEdit(task)}
            style={({ pressed }) => [
              styles.taskRow,
              index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 },
              pressed && { backgroundColor: colors.muted },
            ]}>
            <Pressable
              accessibilityLabel={done ? 'Marcar como não concluída' : 'Concluir tarefa'}
              accessibilityRole="checkbox"
              accessibilityState={{ checked: done }}
              hitSlop={10}
              onPress={() => onToggle({ task, done }, index)}
              style={[
                styles.taskCircle,
                done
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { borderColor: colors.textSecondary },
              ]}>
              {done ? <Ionicons color={colors.onAccent} name="checkmark" size={11} /> : null}
            </Pressable>
            <View style={styles.taskCopy}>
              <AppText
                color={done ? 'secondary' : 'primary'}
                numberOfLines={1}
                style={done ? styles.taskDone : undefined}>
                {task.title}
              </AppText>
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {task.dueAt ?? 'Sem prazo'}
              </AppText>
            </View>
            {done ? null : <View style={[styles.statusDot, { backgroundColor: statusColor }]} />}
          </Pressable>
        );
      })}
    </View>
  );
}

function PlanList({ plans }: { plans: HomePlan[] }) {
  const { colors } = useAppTheme();
  if (plans.length === 0) {
    return <EmptyState icon="map-outline" message="Nenhum plano ativo no momento." />;
  }

  return (
    <View style={styles.cardGap}>
      {plans.map((plan) => (
        <View
          key={plan.id}
          style={[styles.planCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          {plan.thumbnailUri ? (
            <Image cachePolicy="disk" contentFit="cover" source={plan.thumbnailUri} style={styles.planImage} />
          ) : (
            <View style={[styles.planImage, styles.imageFallback, { backgroundColor: colors.accentSoft }]}>
              <Ionicons color={colors.accent} name="map-outline" size={21} />
            </View>
          )}
          <View style={styles.planCopy}>
            <AppText numberOfLines={1}>{plan.title}</AppText>
            <AppText color="secondary" numberOfLines={1} variant="caption">
              {[plan.startAt, plan.location].filter(Boolean).join(' · ') || 'Detalhes a definir'}
            </AppText>
            <AppText color="accent" numberOfLines={1} variant="caption">
              {formatCurrency(plan.actualCostCents)}
              {plan.estimatedCostCents !== null
                ? ` de ${formatCurrency(plan.estimatedCostCents)}`
                : ''}
            </AppText>
          </View>
          <Ionicons color={colors.textSecondary} name="chevron-forward" size={17} />
        </View>
      ))}
    </View>
  );
}

function WishlistList({ items }: { items: HomeWishlistItem[] }) {
  const { colors } = useAppTheme();
  if (items.length === 0) {
    return <EmptyState icon="heart-outline" message="Adicione desejos para destacá-los na Home." />;
  }

  return (
    <FlatList
      contentContainerStyle={styles.wishlistContent}
      data={items}
      horizontal
      initialNumToRender={4}
      keyExtractor={(item) => item.id}
      maxToRenderPerBatch={4}
      renderItem={({ item }) => (
        <Pressable
          accessibilityHint="Abre o produto"
          accessibilityLabel={item.name}
          accessibilityRole="button"
          onPress={() =>
            router.push({ pathname: '/wishlist/[id]', params: { id: item.id } }, { withAnchor: true })
          }
          style={({ pressed }) => [styles.wishlistItem, pressed && styles.pressed]}>
          {item.imageUri ? (
            <Image cachePolicy="disk" contentFit="cover" source={item.imageUri} style={styles.wishlistImage} />
          ) : (
            <View
              style={[
                styles.wishlistImage,
                styles.imageFallback,
                { backgroundColor: colors.accentSoft },
              ]}>
              <Ionicons color={colors.accent} name="image-outline" size={24} />
            </View>
          )}
          <AppText numberOfLines={1} variant="label">
            {item.name}
          </AppText>
          <AppText color="secondary" numberOfLines={1} variant="caption">
            {item.priceCents === null ? 'Preço não informado' : formatCurrency(item.priceCents)}
          </AppText>
        </Pressable>
      )}
      showsHorizontalScrollIndicator={false}
    />
  );
}

function GoalList({ goals }: { goals: HomeGoal[] }) {
  const { colors } = useAppTheme();
  if (goals.length === 0) {
    return <EmptyState icon="flag-outline" message="Suas metas de economia aparecerão aqui." />;
  }

  return (
    <View style={[styles.goalsCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {goals.map((goal) => {
        const progress =
          goal.targetAmountCents > 0
            ? Math.min(goal.currentAmountCents / goal.targetAmountCents, 1)
            : 0;
        return (
          <View key={goal.id} style={styles.goalRow}>
            <View style={styles.goalHeading}>
              <AppText numberOfLines={1} variant="label">
                {goal.icon ? `${goal.icon} ` : ''}
                {goal.title}
              </AppText>
              <AppText color="secondary" variant="caption">
                {Math.round(progress * 100)}%
              </AppText>
            </View>
            <View style={[styles.goalTrack, { backgroundColor: colors.accentSoft }]}>
              <View
                style={[
                  styles.goalFill,
                  { backgroundColor: colors.accent, width: `${progress * 100}%` },
                ]}
              />
            </View>
          </View>
        );
      })}
    </View>
  );
}

export function HomeScreen() {
  const { colors, profile } = useAppTheme();
  const summary = useHomeSummary();
  const [now, setNow] = useState(() => new Date());
  const [activeSheet, setActiveSheet] = useState<QuickActionSheet | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);
  const firstLetter = profile.preferredName.charAt(0).toUpperCase() || 'M';
  const lateNightMessage = getLateNightMessage(now);

  const closeSheet = useCallback(() => setActiveSheet(null), []);
  const hideToast = useCallback(() => setToast(null), []);
  const [editingTask, setEditingTask] = useState<TaskItem | null>(null);
  // Tasks checked here stay visible (struck through) until the user leaves the
  // Home, so a check can be undone in place; the summary itself lists pending only.
  const [checkedTasks, setCheckedTasks] = useState<Map<string, { task: HomeTask; index: number }>>(
    () => new Map(),
  );
  const togglingIds = useRef(new Set<string>());

  useFocusEffect(
    useCallback(
      () => () => {
        setCheckedTasks(new Map());
      },
      [],
    ),
  );

  const closeTaskEdit = useCallback(() => setEditingTask(null), []);
  const handleTaskEdited = useCallback((text: string) => {
    setEditingTask(null);
    setToast({ id: Date.now(), text });
  }, []);

  const openTaskEdit = async (task: HomeTask) => {
    try {
      const full = await getTask(task.id);
      if (full) setEditingTask(full);
    } catch (error: unknown) {
      console.error('Falha ao abrir tarefa.', error);
      setToast({ id: Date.now(), text: 'Não foi possível abrir a tarefa.' });
    }
  };

  const toggleTask = async ({ task, done }: HomeTaskEntry, index: number) => {
    if (togglingIds.current.has(task.id)) return;
    togglingIds.current.add(task.id);
    setCheckedTasks((current) => {
      const next = new Map(current);
      if (done) next.delete(task.id);
      else next.set(task.id, { task, index });
      return next;
    });
    try {
      await toggleTaskCompleted(task.id, !done);
    } catch (error: unknown) {
      console.error('Falha ao concluir tarefa.', error);
      setToast({ id: Date.now(), text: 'Não foi possível atualizar a tarefa.' });
    } finally {
      togglingIds.current.delete(task.id);
    }
  };

  const handleSaved = useCallback((text: string) => {
    setActiveSheet(null);
    setToast({ id: Date.now(), text });
  }, []);

  useEffect(() => {
    const timer = setInterval(() => setNow(new Date()), 60_000);
    return () => clearInterval(timer);
  }, []);

  if (summary.status === 'loading') {
    return (
      <SafeAreaView style={[styles.loading, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  if (summary.status === 'error') {
    return (
      <SafeAreaView style={[styles.loading, { backgroundColor: colors.background }]}>
        <EmptyState icon="alert-circle-outline" message="Não foi possível carregar a Home." />
      </SafeAreaView>
    );
  }

  const data = summary.data;
  const taskEntries: HomeTaskEntry[] = data.tasks
    .filter((task) => !checkedTasks.has(task.id))
    .map((task) => ({ task, done: false }));
  for (const { task, index } of [...checkedTasks.values()].sort((a, b) => a.index - b.index)) {
    taskEntries.splice(Math.min(index, taskEntries.length), 0, { task, done: true });
  }

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <ScrollView
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText color="secondary" variant="caption">
              {formatHomeDate(now)}
            </AppText>
            <View style={styles.greetingRow}>
              <AppText numberOfLines={1} style={styles.greeting} variant="title">
                {getGreeting(now)}, {profile.preferredName}
              </AppText>
              <Ionicons color={colors.text} name="sparkles" size={19} />
            </View>
            {lateNightMessage ? (
              <AppText color="secondary" style={styles.lateNight} variant="caption">
                {lateNightMessage}
              </AppText>
            ) : null}
          </View>
          <Pressable
            accessibilityLabel="Abrir ajustes"
            onPress={() => router.push('/settings')}
            style={({ pressed }) => [
              styles.avatar,
              { backgroundColor: colors.accentSoft },
              pressed && styles.pressed,
            ]}>
            <AppText color="accent" variant="label">
              {firstLetter}
            </AppText>
          </Pressable>
        </View>

        <QuickActions onOpen={setActiveSheet} />
        <FinanceCard {...data.monthlyFinance} />
        <SecondaryShortcuts />

        <View style={styles.section}>
          <SectionHeader href="/(tabs)/tasks" title="Próximas tarefas" />
          <TaskList
            entries={taskEntries}
            onEdit={(task) => void openTaskEdit(task)}
            onToggle={(entry, index) => void toggleTask(entry, index)}
          />
        </View>

        <View style={styles.section}>
          <SectionHeader href="/(tabs)/plans" title="Planos ativos" />
          <PlanList plans={data.plans} />
        </View>

        <View style={styles.section}>
          <SectionHeader href="/(tabs)/wishlist" title="Desejos em destaque" />
          <WishlistList items={data.wishlist} />
        </View>

        <View style={styles.section}>
          <SectionHeader href="/goals" title="Metas" />
          <GoalList goals={data.goals} />
        </View>

      </ScrollView>

      <Toast message={toast} onHide={hideToast} />
      <TaskQuickSheet onClose={closeSheet} onSaved={handleSaved} visible={activeSheet === 'task'} />
      <TaskQuickSheet
        onClose={closeTaskEdit}
        onSaved={handleTaskEdited}
        task={editingTask}
        visible={editingTask !== null}
      />
      <TransactionQuickSheet onClose={closeSheet} onSaved={handleSaved} visible={activeSheet === 'transaction'} />
      <WishlistQuickSheet onClose={closeSheet} onSaved={handleSaved} visible={activeSheet === 'wishlist'} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  avatar: {
    alignItems: 'center',
    borderRadius: 20,
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  cardGap: {
    gap: 10,
  },
  content: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 560,
    padding: 16,
    paddingBottom: 34,
    width: '100%',
  },
  emptyCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    minHeight: 66,
    padding: 13,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 17,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  emptyMessage: {
    flex: 1,
    marginLeft: 11,
  },
  financeAmount: {
    fontFamily: 'Inter_700Bold',
    fontSize: 28,
    letterSpacing: -0.8,
    marginTop: 5,
  },
  financeCard: {
    borderRadius: 20,
    padding: 18,
  },
  financeFooter: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    marginTop: 8,
  },
  goalFill: {
    borderRadius: 3,
    height: 6,
  },
  goalHeading: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  goalRow: {
    gap: 7,
  },
  goalTrack: {
    borderRadius: 3,
    height: 6,
    overflow: 'hidden',
  },
  goalsCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 15,
    padding: 15,
  },
  greeting: {
    flexShrink: 1,
  },
  greetingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
    marginTop: 3,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    marginBottom: 2,
  },
  headerCopy: {
    flex: 1,
    paddingRight: 10,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  lateNight: {
    marginTop: 3,
  },
  listCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  loading: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  onAccentMuted: {
    opacity: 0.82,
  },
  planCard: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    padding: 10,
  },
  planCopy: {
    flex: 1,
    gap: 2,
    marginHorizontal: 10,
  },
  planImage: {
    borderRadius: 14,
    height: 58,
    width: 58,
  },
  pressed: {
    opacity: 0.68,
  },
  progressFill: {
    borderRadius: 4,
    height: 7,
  },
  progressTrack: {
    borderRadius: 4,
    height: 7,
    marginTop: 17,
    overflow: 'hidden',
  },
  quickAction: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 5,
    height: 42,
    justifyContent: 'center',
  },
  quickActions: {
    flexDirection: 'row',
    gap: 7,
  },
  screen: {
    flex: 1,
  },
  section: {
    gap: 10,
    marginTop: 5,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  shortcut: {
    alignItems: 'center',
    borderRadius: 15,
    borderWidth: 1,
    flex: 1,
    gap: 6,
    height: 62,
    justifyContent: 'center',
  },
  shortcutLabel: {
    fontSize: 10,
  },
  shortcutRow: {
    flexDirection: 'row',
    gap: 7,
  },
  statusDot: {
    borderRadius: 3,
    height: 6,
    width: 6,
  },
  taskCircle: {
    alignItems: 'center',
    borderRadius: 8,
    borderWidth: 1.4,
    height: 16,
    justifyContent: 'center',
    width: 16,
  },
  taskDone: {
    textDecorationLine: 'line-through',
  },
  taskCopy: {
    flex: 1,
    marginHorizontal: 10,
  },
  taskRow: {
    alignItems: 'center',
    flexDirection: 'row',
    minHeight: 53,
    paddingHorizontal: 14,
  },
  wishlistContent: {
    gap: 10,
    paddingRight: 16,
  },
  wishlistImage: {
    borderRadius: 14,
    height: 116,
    marginBottom: 7,
    width: 116,
  },
  wishlistItem: {
    width: 116,
  },
});
