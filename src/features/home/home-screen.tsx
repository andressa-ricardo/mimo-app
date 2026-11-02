import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { type Href, router } from 'expo-router';
import { useEffect, useState } from 'react';
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
import type {
  HomeGoal,
  HomeNote,
  HomePlan,
  HomeTask,
  HomeWishlistItem,
} from '@/features/home/home-types';
import { useHomeSummary } from '@/features/home/use-home-summary';
import { useAppTheme } from '@/theme/theme-provider';
import { formatCurrency, formatHomeDate, getGreeting } from '@/utils/format';

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

function QuickActions() {
  const { colors } = useAppTheme();
  const actions: { href: Href; label: string }[] = [
    { label: 'Tarefa', href: '/(tabs)/tasks' },
    { label: 'Gasto', href: '/(tabs)/finances' },
    { label: 'Desejo', href: '/(tabs)/wishlist' },
  ];

  return (
    <View style={styles.quickActions}>
      {actions.map((action) => (
        <Pressable
          accessibilityRole="button"
          key={action.label}
          onPress={() => router.push(action.href)}
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
    { label: 'Notas', icon: 'document-text-outline', href: '/notes' },
    { label: 'Metas', icon: 'disc-outline', href: '/goals' },
    { label: 'Calendário', icon: 'calendar-outline', href: '/calendar' },
    { label: 'Ajustes', icon: 'settings-outline', href: '/settings' },
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

function TaskList({ tasks }: { tasks: HomeTask[] }) {
  const { colors } = useAppTheme();
  if (tasks.length === 0) {
    return <EmptyState icon="checkmark-circle-outline" message="Nenhuma tarefa próxima por aqui." />;
  }

  return (
    <View style={[styles.listCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
      {tasks.map((task, index) => {
        const statusColor = task.isOverdue
          ? colors.error
          : task.priority === 'high'
            ? colors.error
            : task.priority === 'medium'
              ? colors.warning
              : colors.info;
        return (
          <View
            key={task.id}
            style={[styles.taskRow, index > 0 && { borderTopColor: colors.border, borderTopWidth: 1 }]}>
            <View style={[styles.taskCircle, { borderColor: colors.textSecondary }]} />
            <View style={styles.taskCopy}>
              <AppText numberOfLines={1}>{task.title}</AppText>
              <AppText color="secondary" numberOfLines={1} variant="caption">
                {task.dueAt ?? 'Sem prazo'}
              </AppText>
            </View>
            <View style={[styles.statusDot, { backgroundColor: statusColor }]} />
          </View>
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
        <View style={styles.wishlistItem}>
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
        </View>
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

function NoteGrid({ notes }: { notes: HomeNote[] }) {
  const { colors } = useAppTheme();
  if (notes.length === 0) {
    return <EmptyState icon="document-text-outline" message="Nenhuma nota recente ainda." />;
  }

  return (
    <View style={styles.notesGrid}>
      {notes.map((note) => (
        <View
          key={note.id}
          style={[styles.noteCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.noteTitleRow}>
            <AppText numberOfLines={1} style={styles.noteTitle}>
              {note.title}
            </AppText>
            {note.pinned ? <Ionicons color={colors.accent} name="pin-outline" size={14} /> : null}
          </View>
          <AppText color="secondary" numberOfLines={3} variant="caption">
            {note.preview}
          </AppText>
        </View>
      ))}
    </View>
  );
}

export function HomeScreen() {
  const { colors, profile } = useAppTheme();
  const summary = useHomeSummary();
  const [now, setNow] = useState(() => new Date());
  const firstLetter = profile.preferredName.charAt(0).toUpperCase() || 'M';

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

        <QuickActions />
        <FinanceCard {...data.monthlyFinance} />
        <SecondaryShortcuts />

        <View style={styles.section}>
          <SectionHeader href="/(tabs)/tasks" title="Próximas tarefas" />
          <TaskList tasks={data.tasks} />
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

        <View style={styles.section}>
          <SectionHeader href="/notes" title="Notas recentes" />
          <NoteGrid notes={data.notes} />
        </View>
      </ScrollView>
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
  noteCard: {
    borderRadius: 17,
    borderWidth: 1,
    flexBasis: '48%',
    flexGrow: 1,
    minHeight: 105,
    padding: 14,
  },
  noteTitle: {
    flex: 1,
  },
  noteTitleRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    marginBottom: 7,
  },
  notesGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 10,
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
    borderRadius: 8,
    borderWidth: 1.4,
    height: 16,
    width: 16,
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
