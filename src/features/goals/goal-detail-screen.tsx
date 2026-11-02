import Ionicons from '@expo/vector-icons/Ionicons';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useState } from 'react';
import { ActivityIndicator, Modal, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { deleteGoal, setGoalArchived } from '@/database/repositories/goals-repository';
import { describeRemaining, GoalProgressBar, GoalStatusPill } from '@/features/goals/components/goal-card';
import { GoalPlanSection } from '@/features/goals/components/goal-plan-section';
import { GoalSheet } from '@/features/goals/components/goal-sheet';
import { MovementSheet, type MovementSheetMode } from '@/features/goals/components/movement-sheet';
import { goalProgress } from '@/features/goals/goal-math';
import { useGoalDetail } from '@/features/goals/use-goals';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import type { Goal, GoalMovement } from '@/types/goals';
import { formatDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

function HeaderButton({
  icon,
  label,
  onPress,
}: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  const { colors } = useAppTheme();
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
      <Ionicons color={colors.text} name={icon} size={21} />
    </Pressable>
  );
}

function OptionsMenu({
  goal,
  onArchiveToggle,
  onClose,
  onDelete,
  visible,
}: {
  goal: Goal;
  onArchiveToggle: () => void;
  onClose: () => void;
  onDelete: () => void;
  visible: boolean;
}) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const archived = goal.status === 'archived';
  const items = [
    {
      label: archived ? 'Reativar meta' : 'Arquivar meta',
      icon: archived ? 'refresh-outline' : 'archive-outline',
      color: colors.text,
      onPress: onArchiveToggle,
    },
    { label: 'Excluir meta', icon: 'trash-outline', color: colors.error, onPress: onDelete },
  ] as const;

  return (
    <Modal animationType="fade" navigationBarTranslucent onRequestClose={onClose} statusBarTranslucent transparent visible={visible}>
      <Pressable accessibilityLabel="Fechar menu" onPress={onClose} style={StyleSheet.absoluteFill} />
      <View
        style={[styles.menu, { backgroundColor: colors.surface, borderColor: colors.border, top: insets.top + 50 }]}>
        {items.map((item, index) => (
          <Pressable
            accessibilityRole="menuitem"
            key={item.label}
            onPress={() => {
              onClose();
              item.onPress();
            }}
            style={({ pressed }) => [
              styles.menuItem,
              index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
              pressed && { backgroundColor: colors.muted },
            ]}>
            <Ionicons color={item.color} name={item.icon} size={18} />
            <AppText style={{ color: item.color }}>{item.label}</AppText>
          </Pressable>
        ))}
      </View>
    </Modal>
  );
}

function HistoryRow({ first, movement, onPress }: { first: boolean; movement: GoalMovement; onPress: () => void }) {
  const { colors } = useAppTheme();
  const contribution = movement.type === 'contribution';
  // Semantic colors: they never follow the accent theme.
  const color = contribution ? colors.income : colors.expense;
  return (
    <Pressable
      accessibilityHint="Editar lançamento"
      accessibilityLabel={`${contribution ? 'Aporte' : 'Retirada'} de ${formatCurrency(movement.amountCents)} em ${formatDateKey(movement.date)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.historyRow,
        !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: colors.muted },
      ]}>
      <View style={[styles.historyIcon, { backgroundColor: `${color}1A` }]}>
        <Ionicons color={color} name={contribution ? 'arrow-up' : 'arrow-down'} size={15} />
      </View>
      <View style={styles.flex}>
        <AppText style={[styles.historyAmount, { color }]}>
          {contribution ? '+' : '−'} {formatCurrency(movement.amountCents)}
        </AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {formatDateKey(movement.date)}
          {movement.note ? ` · ${movement.note}` : ''}
        </AppText>
      </View>
      <Ionicons color={colors.textSecondary} name="chevron-forward" size={16} />
    </Pressable>
  );
}

export function GoalDetailScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useGoalDetail(id);
  const [editing, setEditing] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const [deleting, setDeleting] = useState(false);
  const [movementMode, setMovementMode] = useState<MovementSheetMode | null>(null);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const hideToast = useCallback(() => setToast(null), []);
  const closeEdit = useCallback(() => setEditing(false), []);
  const closeMovement = useCallback(() => setMovementMode(null), []);
  const handleEdited = useCallback(
    (text: string) => {
      setEditing(false);
      showToast(text);
    },
    [showToast],
  );
  const handleMovementSaved = useCallback(
    (text: string) => {
      setMovementMode(null);
      showToast(text);
    },
    [showToast],
  );

  if (state.status === 'loading') {
    return (
      <SafeAreaView style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const goal = state.data?.goal ?? null;
  if (!goal) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <HeaderButton icon="chevron-back" label="Voltar" onPress={() => router.back()} />
        </View>
        <View style={styles.centered}>
          <AppText color="secondary">
            {state.status === 'error' ? 'Não foi possível carregar a meta.' : 'Esta meta não existe mais.'}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const movements = state.data?.movements ?? [];
  const progress = goalProgress(goal.savedAmountCents, goal.targetAmountCents);
  const archived = goal.status === 'archived';

  const toggleArchived = async () => {
    try {
      await setGoalArchived(goal.id, !archived);
      notifyDataChanged('goals');
      showToast(archived ? 'Meta reativada.' : 'Meta arquivada.');
    } catch (error: unknown) {
      console.error('Falha ao arquivar meta.', error);
      showToast('Não foi possível atualizar a meta.');
    }
  };

  const removeGoal = async () => {
    if (deleting) return;
    setDeleting(true);
    try {
      await deleteGoal(goal.id);
      setConfirmDelete(false);
      router.back();
      notifyDataChanged('goals');
    } catch (error: unknown) {
      console.error('Falha ao excluir meta.', error);
      setConfirmDelete(false);
      setDeleting(false);
      showToast('Não foi possível excluir a meta.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <HeaderButton icon="chevron-back" label="Voltar" onPress={() => router.back()} />
        <AppText numberOfLines={1} style={styles.headerTitle} variant="section">
          {goal.title}
        </AppText>
        <HeaderButton icon="pencil-outline" label="Editar meta" onPress={() => setEditing(true)} />
        <HeaderButton icon="ellipsis-horizontal" label="Mais opções" onPress={() => setMenuOpen(true)} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <View style={[styles.mainCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <View style={styles.mainHeading}>
            <View style={[styles.iconBubble, { backgroundColor: colors.accentSoft }]}>
              <AppText style={styles.iconText}>{goal.icon ?? '🎯'}</AppText>
            </View>
            <View style={styles.flex}>
              <AppText numberOfLines={2} variant="section">
                {goal.title}
              </AppText>
              {goal.categoryName ? (
                <AppText color="secondary" variant="caption">
                  {goal.categoryName}
                </AppText>
              ) : null}
            </View>
            <GoalStatusPill goal={goal} />
          </View>

          <View style={styles.amountRow}>
            <View style={styles.flex}>
              <AppText style={styles.saved}>{formatCurrency(goal.savedAmountCents)}</AppText>
              <AppText color="secondary" variant="caption">
                guardados · Meta: {formatCurrency(goal.targetAmountCents)}
              </AppText>
            </View>
            <AppText color="accent" style={styles.percent}>
              {progress.percent}%
            </AppText>
          </View>

          <GoalProgressBar fraction={progress.fraction} />

          <View style={styles.metaRow}>
            <AppText variant="caption">{describeRemaining(goal)}</AppText>
            {goal.targetDate ? (
              <AppText color="secondary" variant="caption">
                até {formatDateKey(goal.targetDate)}
              </AppText>
            ) : null}
          </View>

          {goal.linkedWishlistItemId && goal.linkedWishlistItemName ? (
            <Pressable
              accessibilityHint="Abre o produto na Wishlist"
              accessibilityRole="link"
              onPress={() =>
                router.push({ pathname: '/wishlist/[id]', params: { id: goal.linkedWishlistItemId ?? '' } }, { withAnchor: true })
              }
              style={({ pressed }) => [styles.linkRow, { backgroundColor: colors.muted }, pressed && styles.pressed]}>
              <Ionicons color={colors.accent} name="heart-outline" size={16} />
              <AppText numberOfLines={1} style={styles.flex} variant="caption">
                Desejo: {goal.linkedWishlistItemName}
              </AppText>
              <Ionicons color={colors.textSecondary} name="chevron-forward" size={15} />
            </Pressable>
          ) : null}
        </View>

        {archived ? (
          <View style={[styles.notice, { backgroundColor: colors.muted }]}>
            <AppText color="secondary" style={styles.flex} variant="caption">
              Esta meta está arquivada e não entra nos totais.
            </AppText>
            <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void toggleArchived()}>
              <AppText color="accent" variant="label">
                Reativar
              </AppText>
            </Pressable>
          </View>
        ) : null}

        <View style={styles.actions}>
          <View style={styles.flex}>
            <PrimaryButton label="+ Adicionar dinheiro" onPress={() => setMovementMode({ kind: 'contribution' })} />
          </View>
          <View style={styles.flex}>
            <PrimaryButton
              disabled={goal.savedAmountCents <= 0}
              label="Retirar dinheiro"
              onPress={() => setMovementMode({ kind: 'withdrawal' })}
              variant="outlined"
            />
          </View>
        </View>

        {goal.description ? (
          <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText color="accent" variant="caption">
              Motivação
            </AppText>
            <AppText>{goal.description}</AppText>
          </View>
        ) : null}

        <GoalPlanSection goal={goal} onFeedback={showToast} sections={state.data?.sections ?? []} />

        <View style={styles.section}>
          <AppText accessibilityRole="header" variant="section">
            Histórico
          </AppText>
          {movements.length === 0 ? (
            <View style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              <AppText color="secondary" style={styles.center} variant="caption">
                Nenhum lançamento ainda. Que tal o primeiro aporte?
              </AppText>
            </View>
          ) : (
            <View style={[styles.historyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
              {movements.map((movement, index) => (
                <HistoryRow
                  first={index === 0}
                  key={movement.id}
                  movement={movement}
                  onPress={() => setMovementMode({ kind: 'edit', movement })}
                />
              ))}
            </View>
          )}
        </View>
      </ScrollView>

      <Toast message={toast} onHide={hideToast} />
      <OptionsMenu
        goal={goal}
        onArchiveToggle={() => void toggleArchived()}
        onClose={() => setMenuOpen(false)}
        onDelete={() => setConfirmDelete(true)}
        visible={menuOpen}
      />
      <GoalSheet goal={goal} onClose={closeEdit} onSaved={handleEdited} visible={editing} />
      <MovementSheet goal={movementMode ? goal : null} mode={movementMode} onClose={closeMovement} onSaved={handleMovementSaved} />
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={deleting}
        message="A meta e todo o histórico de aportes e retiradas serão apagados. O desejo vinculado e suas finanças não serão alterados."
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() => void removeGoal()}
        title="Excluir meta?"
        tone="destructive"
        visible={confirmDelete}
      />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  amountRow: {
    alignItems: 'flex-end',
    flexDirection: 'row',
    gap: 10,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  center: {
    textAlign: 'center',
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 560,
    paddingBottom: 32,
    paddingHorizontal: 16,
    width: '100%',
  },
  flex: {
    flex: 1,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 2,
    paddingHorizontal: 8,
    paddingVertical: 6,
  },
  headerButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerTitle: {
    flex: 1,
    marginLeft: 2,
  },
  historyAmount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  historyCard: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  historyIcon: {
    alignItems: 'center',
    borderRadius: 15,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  historyRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
  iconBubble: {
    alignItems: 'center',
    borderRadius: 22,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  iconText: {
    fontSize: 22,
    lineHeight: 28,
  },
  linkRow: {
    alignItems: 'center',
    borderRadius: 12,
    flexDirection: 'row',
    gap: 8,
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  mainCard: {
    borderRadius: 22,
    borderWidth: 1,
    gap: 12,
    padding: 18,
  },
  mainHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    elevation: 6,
    minWidth: 200,
    overflow: 'hidden',
    position: 'absolute',
    right: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  menuItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  metaRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  notice: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 10,
    padding: 12,
  },
  percent: {
    fontFamily: 'Inter_700Bold',
    fontSize: 22,
    lineHeight: 30,
  },
  pressed: {
    opacity: 0.6,
  },
  saved: {
    fontFamily: 'Inter_700Bold',
    fontSize: 26,
    letterSpacing: -0.6,
    lineHeight: 34,
  },
  screen: {
    flex: 1,
  },
  section: {
    gap: 10,
  },
});
