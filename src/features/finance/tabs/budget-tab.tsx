import { useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { BudgetSheet } from '@/features/finance/components/budget-sheet';
import { EmptyNote, ProgressBar, SectionHeader } from '@/features/finance/components/finance-ui';
import { budgetProgress } from '@/features/finance/month-data';
import type { FinanceMonthData } from '@/features/finance/use-finance-month';
import { categoryColor } from '@/theme/category-colors';
import { useAppTheme } from '@/theme/theme-provider';
import type { Budget } from '@/types/finance';
import { formatCurrency } from '@/utils/format';
import { percentOf } from '@/utils/money';

type SheetState = { open: false } | { open: true; budget: Budget | null };

export function BudgetTab({ data, onFeedback }: { data: FinanceMonthData; onFeedback: (message: string) => void }) {
  const { colors, isDark } = useAppTheme();
  const [sheet, setSheet] = useState<SheetState>({ open: false });
  const progress = budgetProgress(data.budgets, data.summary);

  return (
    <View style={styles.container}>
      <SectionHeader
        actionLabel="+ Categoria"
        onAction={() => setSheet({ open: true, budget: null })}
        title="Orçamentos mensais"
      />

      {progress.length === 0 ? (
        <EmptyNote>Defina um limite mensal por categoria para acompanhar seus gastos.</EmptyNote>
      ) : (
        progress.map((budget) => {
          const percent = percentOf(budget.spentCents, budget.amountCents);
          const over = budget.spentCents > budget.amountCents;
          const difference = Math.abs(budget.amountCents - budget.spentCents);
          return (
            <Pressable
              accessibilityHint="Editar orçamento"
              accessibilityLabel={`${budget.categoryName}: ${percent}% do orçamento`}
              accessibilityRole="button"
              key={budget.categoryId}
              onPress={() => setSheet({ open: true, budget })}
              style={({ pressed }) => [
                styles.card,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <View style={styles.heading}>
                <View style={[styles.dot, { backgroundColor: categoryColor(budget.categoryId, isDark) }]} />
                <AppText numberOfLines={1} style={styles.flex}>
                  {budget.categoryName}
                </AppText>
                <AppText
                  color="secondary"
                  style={over ? { color: colors.error } : undefined}
                  variant="caption">
                  {percent}%
                </AppText>
              </View>
              <ProgressBar
                color={over ? colors.error : colors.accent}
                fraction={budget.spentCents / budget.amountCents}
              />
              <AppText color="secondary" variant="caption">
                {formatCurrency(budget.spentCents)} de {formatCurrency(budget.amountCents)} ·{' '}
                <AppText style={over ? { color: colors.error } : undefined} variant="caption" color="secondary">
                  {over ? `${formatCurrency(difference)} acima` : `restam ${formatCurrency(difference)}`}
                </AppText>
              </AppText>
            </Pressable>
          );
        })
      )}

      <BudgetSheet
        budget={sheet.open ? sheet.budget : null}
        existingCategoryIds={data.budgets.map((budget) => budget.categoryId)}
        onClose={() => setSheet({ open: false })}
        onSaved={(message) => {
          setSheet({ open: false });
          onFeedback(message);
        }}
        visible={sheet.open}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 10,
    padding: 14,
  },
  container: {
    gap: 12,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  flex: {
    flex: 1,
  },
  heading: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  pressed: {
    opacity: 0.75,
  },
});
