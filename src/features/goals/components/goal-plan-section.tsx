import Ionicons from '@expo/vector-icons/Ionicons';
import * as Linking from 'expo-linking';
import { useCallback, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import { setSectionItemDone } from '@/database/repositories/goal-plan-repository';
import { updateGoal } from '@/database/repositories/goals-repository';
import { GoalPlanSheet, type PlanSheetState } from '@/features/goals/components/goal-plan-sheets';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import type { Goal, GoalSection, GoalSectionItem } from '@/types/goals';
import { formatCurrency } from '@/utils/format';
import { displayHost } from '@/utils/url';

type GoalPlanSectionProps = {
  goal: Goal;
  onFeedback: (message: string) => void;
  sections: GoalSection[];
};

function IdeaRow({
  first,
  item,
  onEdit,
  onFeedback,
}: {
  first: boolean;
  item: GoalSectionItem;
  onEdit: () => void;
  onFeedback: (message: string) => void;
}) {
  const { colors } = useAppTheme();
  const meta = [
    item.priceCents !== null ? formatCurrency(item.priceCents) : null,
    item.url ? displayHost(item.url) : null,
  ].filter(Boolean);

  const toggleDone = async () => {
    try {
      await setSectionItemDone(item.id, !item.done);
      notifyDataChanged('goals');
    } catch (error: unknown) {
      console.error('Falha ao marcar ideia.', error);
      onFeedback('Não foi possível atualizar a ideia.');
    }
  };

  const openLink = async () => {
    if (!item.url) return;
    try {
      await Linking.openURL(item.url);
    } catch {
      onFeedback('Não foi possível abrir o link.');
    }
  };

  return (
    <Pressable
      accessibilityHint="Editar ideia"
      accessibilityLabel={`${item.title}${item.done ? ', escolhida' : ''}`}
      accessibilityRole="button"
      onPress={onEdit}
      style={({ pressed }) => [
        styles.ideaRow,
        !first && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
        pressed && { backgroundColor: colors.muted },
      ]}>
      <Pressable
        accessibilityLabel={item.done ? 'Desmarcar como escolhida' : 'Marcar como escolhida'}
        accessibilityRole="checkbox"
        accessibilityState={{ checked: item.done }}
        hitSlop={10}
        onPress={() => void toggleDone()}
        style={[
          styles.check,
          item.done
            ? { backgroundColor: colors.accent, borderColor: colors.accent }
            : { borderColor: colors.textSecondary },
        ]}>
        {item.done ? <Ionicons color={colors.onAccent} name="checkmark" size={12} /> : null}
      </Pressable>
      <View style={styles.flex}>
        <AppText numberOfLines={1}>{item.title}</AppText>
        {meta.length > 0 || item.note ? (
          <AppText color="secondary" numberOfLines={1} variant="caption">
            {[...meta, item.note].filter(Boolean).join(' · ')}
          </AppText>
        ) : null}
      </View>
      {item.url ? (
        <Pressable
          accessibilityHint="Abre no navegador"
          accessibilityLabel={`Abrir link de ${item.title}`}
          accessibilityRole="link"
          hitSlop={8}
          onPress={() => void openLink()}
          style={[styles.linkButton, { backgroundColor: colors.accentSoft }]}>
          <Ionicons color={colors.accent} name="open-outline" size={15} />
        </Pressable>
      ) : null}
    </Pressable>
  );
}

/**
 * Planning blocks of a goal: split the target into parts (passagem, hotel…)
 * and keep ideas with links and prices inside each one.
 */
export function GoalPlanSection({ goal, onFeedback, sections }: GoalPlanSectionProps) {
  const { colors } = useAppTheme();
  const [sheet, setSheet] = useState<PlanSheetState | null>(null);
  const closeSheet = useCallback(() => setSheet(null), []);
  const handleSaved = useCallback(
    (message: string) => {
      setSheet(null);
      onFeedback(message);
    },
    [onFeedback],
  );

  const plannedSections = sections.filter((section) => section.plannedAmountCents !== null);
  const plannedCents = plannedSections.reduce((total, section) => total + (section.plannedAmountCents ?? 0), 0);
  const unassignedCents = goal.targetAmountCents - plannedCents;

  const applySumAsTarget = async () => {
    try {
      await updateGoal({ ...goal, targetAmountCents: plannedCents });
      notifyDataChanged('goals');
      onFeedback(`Meta ajustada para ${formatCurrency(plannedCents)}.`);
    } catch (error: unknown) {
      console.error('Falha ao ajustar meta.', error);
      onFeedback('Não foi possível ajustar a meta.');
    }
  };

  return (
    <View style={styles.section}>
      <View style={styles.sectionHeader}>
        <AppText accessibilityRole="header" variant="section">
          Planejamento
        </AppText>
        {sections.length > 0 ? (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => setSheet({ kind: 'block', section: null })}>
            <AppText color="accent" variant="label">
              + Bloco
            </AppText>
          </Pressable>
        ) : null}
      </View>

      {sections.length === 0 ? (
        <View style={[styles.card, styles.emptyCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText color="secondary" style={styles.center} variant="caption">
            Divida a meta em blocos — passagem, hotel, passeios — e guarde ideias, links e preços em cada um.
          </AppText>
          <PrimaryButton
            icon="albums-outline"
            label="Criar primeiro bloco"
            onPress={() => setSheet({ kind: 'block', section: null })}
            variant="outlined"
          />
        </View>
      ) : null}

      {plannedSections.length > 0 ? (
        <View style={[styles.summary, { backgroundColor: colors.muted }]}>
          <AppText variant="label">
            {formatCurrency(plannedCents)} divididos de {formatCurrency(goal.targetAmountCents)}
          </AppText>
          <AppText color="secondary" variant="caption">
            {unassignedCents > 0
              ? `${formatCurrency(unassignedCents)} ainda sem destino.`
              : unassignedCents < 0
                ? `Os blocos passam a meta em ${formatCurrency(-unassignedCents)}.`
                : 'Todo o valor da meta está dividido.'}
          </AppText>
          {unassignedCents !== 0 && plannedCents > 0 ? (
            <Pressable accessibilityRole="button" hitSlop={6} onPress={() => void applySumAsTarget()}>
              <AppText color="accent" variant="label">
                Usar {formatCurrency(plannedCents)} como valor da meta
              </AppText>
            </Pressable>
          ) : null}
        </View>
      ) : null}

      {sections.map((section) => (
        <View
          key={section.id}
          style={[styles.card, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Pressable
            accessibilityHint="Editar bloco"
            accessibilityRole="button"
            onPress={() => setSheet({ kind: 'block', section })}
            style={({ pressed }) => [styles.blockHeader, pressed && styles.pressed]}>
            <View style={styles.flex}>
              <AppText numberOfLines={1} style={styles.blockTitle}>
                {section.title}
              </AppText>
              <AppText color="secondary" variant="caption">
                {section.items.length === 0
                  ? 'Nenhuma ideia ainda'
                  : `${section.items.length} ${section.items.length === 1 ? 'ideia' : 'ideias'}`}
              </AppText>
            </View>
            <AppText color={section.plannedAmountCents === null ? 'secondary' : 'accent'} variant="label">
              {section.plannedAmountCents === null ? 'Sem valor' : formatCurrency(section.plannedAmountCents)}
            </AppText>
            <Ionicons color={colors.textSecondary} name="create-outline" size={16} />
          </Pressable>

          {section.items.length > 0 ? (
            <View style={[styles.ideas, { borderTopColor: colors.border }]}>
              {section.items.map((item, index) => (
                <IdeaRow
                  first={index === 0}
                  item={item}
                  key={item.id}
                  onEdit={() => setSheet({ kind: 'idea', section, item })}
                  onFeedback={onFeedback}
                />
              ))}
            </View>
          ) : null}

          <Pressable
            accessibilityRole="button"
            hitSlop={6}
            onPress={() => setSheet({ kind: 'idea', section, item: null })}
            style={[styles.addIdea, { borderTopColor: colors.border }]}>
            <AppText color="accent" variant="label">
              + Adicionar ideia
            </AppText>
          </Pressable>
        </View>
      ))}

      <GoalPlanSheet goalId={goal.id} onClose={closeSheet} onSaved={handleSaved} state={sheet} />
    </View>
  );
}

const styles = StyleSheet.create({
  addIdea: {
    borderTopWidth: StyleSheet.hairlineWidth,
    paddingHorizontal: 14,
    paddingVertical: 12,
  },
  blockHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 10,
    padding: 14,
  },
  blockTitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  card: {
    borderRadius: 18,
    borderWidth: 1,
    overflow: 'hidden',
  },
  center: {
    textAlign: 'center',
  },
  check: {
    alignItems: 'center',
    borderRadius: 10,
    borderWidth: 1.5,
    height: 20,
    justifyContent: 'center',
    width: 20,
  },
  emptyCard: {
    gap: 12,
    padding: 16,
  },
  flex: {
    flex: 1,
  },
  ideaRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 54,
    paddingHorizontal: 14,
    paddingVertical: 9,
  },
  ideas: {
    borderTopWidth: StyleSheet.hairlineWidth,
  },
  linkButton: {
    alignItems: 'center',
    borderRadius: 14,
    height: 28,
    justifyContent: 'center',
    width: 28,
  },
  pressed: {
    opacity: 0.7,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  summary: {
    borderRadius: 14,
    gap: 4,
    padding: 12,
  },
});
