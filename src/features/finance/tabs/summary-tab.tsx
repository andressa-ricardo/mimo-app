import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { CategoryPieChart } from '@/features/finance/components/category-pie-chart';
import { SpendingTrendChart } from '@/features/finance/components/spending-trend-chart';
import {
  Card,
  EmptyNote,
  formatShortDate,
  ProgressBar,
  SectionHeader,
} from '@/features/finance/components/finance-ui';
import type { TrendPoint } from '@/features/finance/month-data';
import type { FinanceMonthData } from '@/features/finance/use-finance-month';
import { categoryColor } from '@/theme/category-colors';
import { useAppTheme } from '@/theme/theme-provider';
import type { MonthEntry } from '@/types/finance';
import { formatCurrency } from '@/utils/format';

type SummaryTabProps = {
  confirmingKey: string | null;
  data: FinanceMonthData;
  monthKey: string;
  onConfirm: (entry: MonthEntry) => void;
  onSelectTrend: (point: TrendPoint) => void;
};

function TotalTile({ amountCents, kind }: { amountCents: number; kind: 'income' | 'expense' }) {
  const { colors } = useAppTheme();
  const color = kind === 'income' ? colors.income : colors.expense;
  return (
    <View style={[styles.tile, { backgroundColor: `${color}1A` }]}>
      <View style={styles.tileLabel}>
        <Ionicons color={color} name={kind === 'income' ? 'arrow-up' : 'arrow-down'} size={12} />
        <AppText style={{ color }} variant="caption">
          {kind === 'income' ? 'Receitas' : 'Despesas'}
        </AppText>
      </View>
      <AppText numberOfLines={1} style={styles.tileAmount}>
        {formatCurrency(amountCents)}
      </AppText>
    </View>
  );
}

export function SummaryTab({ confirmingKey, data, monthKey, onConfirm, onSelectTrend }: SummaryTabProps) {
  const { colors, isDark } = useAppTheme();
  const { summary } = data;
  const balanceColor =
    summary.balanceCents < 0 ? colors.expense : summary.balanceCents > 0 ? colors.income : colors.text;
  const topCategory = summary.byCategory[0]?.amountCents ?? 0;
  const [categoryView, setCategoryView] = useState<'bars' | 'pie'>('bars');

  return (
    <View style={styles.container}>
      <Card style={styles.balanceCard}>
        <AppText color="secondary" variant="label">
          Saldo do mês
        </AppText>
        <AppText style={[styles.balance, { color: balanceColor }]}>{formatCurrency(summary.balanceCents)}</AppText>
        <View style={styles.tiles}>
          <TotalTile amountCents={summary.incomeCents} kind="income" />
          <TotalTile amountCents={summary.expenseCents} kind="expense" />
        </View>
        {summary.plannedExpenseCents > 0 ? (
          <View style={[styles.plannedNote, { backgroundColor: colors.muted }]}>
            <Ionicons color={colors.textSecondary} name="time-outline" size={15} />
            <AppText color="secondary" style={styles.plannedText} variant="caption">
              <AppText style={styles.bold} variant="caption">
                {formatCurrency(summary.plannedExpenseCents)}
              </AppText>{' '}
              em gastos planejados — não somados às despesas até serem confirmados.
            </AppText>
          </View>
        ) : null}
      </Card>

      <SpendingTrendChart onSelect={onSelectTrend} points={data.trend} selectedKey={monthKey} />

      <View style={styles.section}>
        <View style={styles.sectionHeader}>
          <AppText accessibilityRole="header" variant="section">
            Gastos por categoria
          </AppText>
          {summary.byCategory.length > 0 ? (
            <View accessibilityRole="radiogroup" style={[styles.viewToggle, { backgroundColor: colors.muted }]}>
              {(
                [
                  { value: 'bars', icon: 'bar-chart-outline', label: 'Ver como barras' },
                  { value: 'pie', icon: 'pie-chart-outline', label: 'Ver como pizza' },
                ] as const
              ).map((option) => {
                const selected = categoryView === option.value;
                return (
                  <Pressable
                    accessibilityLabel={option.label}
                    accessibilityRole="radio"
                    accessibilityState={{ checked: selected }}
                    hitSlop={4}
                    key={option.value}
                    onPress={() => setCategoryView(option.value)}
                    style={[styles.toggleOption, selected && { backgroundColor: colors.surface }]}>
                    <Ionicons color={selected ? colors.accent : colors.textSecondary} name={option.icon} size={16} />
                  </Pressable>
                );
              })}
            </View>
          ) : null}
        </View>
        {summary.byCategory.length === 0 ? (
          <EmptyNote>Nenhuma despesa confirmada neste mês.</EmptyNote>
        ) : categoryView === 'pie' ? (
          <Card style={styles.listCard}>
            <CategoryPieChart categories={summary.byCategory} />
          </Card>
        ) : (
          <Card style={styles.listCard}>
            {summary.byCategory.map((category) => (
              <View key={category.categoryId ?? 'none'} style={styles.categoryRow}>
                <View style={styles.categoryHeading}>
                  <View
                    style={[
                      styles.dot,
                      {
                        backgroundColor: category.categoryId
                          ? categoryColor(category.categoryId, isDark)
                          : colors.chartMuted,
                      },
                    ]}
                  />
                  <AppText numberOfLines={1} style={styles.flex}>
                    {category.name}
                  </AppText>
                  <AppText variant="label">{formatCurrency(category.amountCents)}</AppText>
                </View>
                <ProgressBar color={colors.accent} fraction={category.amountCents / topCategory} />
              </View>
            ))}
          </Card>
        )}
      </View>

      <View style={styles.section}>
        <SectionHeader title="Planejados e recorrentes" />
        {summary.upcoming.length === 0 ? (
          <EmptyNote>Nada planejado ou recorrente neste mês.</EmptyNote>
        ) : (
          <Card>
            {summary.upcoming.map((entry, index) => {
              const planned = entry.status === 'planned';
              return (
                <View
                  key={entry.key}
                  style={[
                    styles.upcomingRow,
                    index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                  ]}>
                  <View style={[styles.upcomingIcon, { backgroundColor: colors.accentSoft }]}>
                    <Ionicons color={colors.accent} name={planned ? 'time-outline' : 'repeat-outline'} size={17} />
                  </View>
                  <View style={styles.flex}>
                    <AppText numberOfLines={1}>{entry.description}</AppText>
                    <AppText color="secondary" numberOfLines={1} variant="caption">
                      {planned ? 'Planejado' : 'Recorrente'} · {formatShortDate(entry.dueDate)} ·{' '}
                      {entry.type === 'income' ? '+' : '−'}
                      {formatCurrency(entry.amountCents)}
                    </AppText>
                  </View>
                  {planned ? (
                    <Pressable
                      accessibilityLabel={`Confirmar ${entry.description}`}
                      accessibilityRole="button"
                      disabled={confirmingKey !== null}
                      onPress={() => onConfirm(entry)}
                      style={({ pressed }) => [
                        styles.confirmButton,
                        { backgroundColor: colors.accent },
                        (pressed || (confirmingKey !== null && confirmingKey !== entry.key)) && styles.dimmed,
                      ]}>
                      {confirmingKey === entry.key ? (
                        <ActivityIndicator color={colors.onAccent} size="small" />
                      ) : (
                        <AppText style={[styles.confirmLabel, { color: colors.onAccent }]} variant="caption">
                          Confirmar
                        </AppText>
                      )}
                    </Pressable>
                  ) : (
                    <Ionicons accessibilityLabel="Confirmado" color={colors.success} name="checkmark-circle" size={18} />
                  )}
                </View>
              );
            })}
          </Card>
        )}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  balance: {
    fontFamily: 'Inter_700Bold',
    fontSize: 30,
    letterSpacing: -0.8,
    lineHeight: 38,
    marginTop: 4,
  },
  balanceCard: {
    padding: 16,
  },
  bold: {
    fontFamily: 'Inter_600SemiBold',
  },
  categoryHeading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  categoryRow: {
    gap: 8,
  },
  confirmButton: {
    alignItems: 'center',
    borderRadius: 14,
    justifyContent: 'center',
    minHeight: 30,
    minWidth: 84,
    paddingHorizontal: 12,
  },
  confirmLabel: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 12,
  },
  container: {
    gap: 18,
  },
  dimmed: {
    opacity: 0.6,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  flex: {
    flex: 1,
  },
  listCard: {
    gap: 14,
    padding: 14,
  },
  plannedNote: {
    alignItems: 'flex-start',
    borderRadius: 14,
    flexDirection: 'row',
    gap: 8,
    marginTop: 12,
    padding: 12,
  },
  plannedText: {
    flex: 1,
  },
  section: {
    gap: 10,
  },
  sectionHeader: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  toggleOption: {
    alignItems: 'center',
    borderRadius: 9,
    height: 28,
    justifyContent: 'center',
    width: 34,
  },
  tile: {
    borderRadius: 16,
    flex: 1,
    gap: 4,
    padding: 12,
  },
  tileAmount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 15,
  },
  tileLabel: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
  },
  tiles: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 14,
  },
  viewToggle: {
    borderRadius: 11,
    flexDirection: 'row',
    gap: 2,
    padding: 2,
  },
  upcomingIcon: {
    alignItems: 'center',
    borderRadius: 16,
    height: 32,
    justifyContent: 'center',
    width: 32,
  },
  upcomingRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 60,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
