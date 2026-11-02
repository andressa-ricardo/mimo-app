import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { FilterChip } from '@/components/ui/filter-chip';
import { capitalize, EmptyNote } from '@/features/finance/components/finance-ui';
import {
  emptyHistoryFilters,
  HistoryFiltersSheet,
  type HistoryFilters,
} from '@/features/finance/components/history-filters-sheet';
import { exportMonthCsv, ExportError } from '@/features/finance/export-csv';
import { searchable } from '@/features/wishlist/wishlist-meta';
import { categoryColor } from '@/theme/category-colors';
import { useAppTheme } from '@/theme/theme-provider';
import type { PaymentMethod } from '@/types/categories';
import type { MonthEntry } from '@/types/finance';
import { parseDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

type TypeFilter = 'all' | 'expense' | 'income' | 'planned';

const typeFilters: { value: TypeFilter; label: string }[] = [
  { value: 'all', label: 'Tudo' },
  { value: 'expense', label: 'Despesas' },
  { value: 'income', label: 'Receitas' },
  { value: 'planned', label: 'Planejado' },
];

const dayFormatter = new Intl.DateTimeFormat('pt-BR', { weekday: 'long', day: 'numeric', month: 'long' });

function matchesType(entry: MonthEntry, filter: TypeFilter): boolean {
  if (filter === 'planned') return entry.status === 'planned';
  if (filter === 'all') return true;
  return entry.type === filter;
}

function describeEntry(entry: MonthEntry): string {
  const parts = [entry.categoryName ?? 'Sem categoria'];
  if (entry.paymentMethodName) parts.push(entry.paymentMethodName);
  if (entry.installmentCount > 1) parts.push(`Parcela ${entry.sequence}/${entry.installmentCount}`);
  if (entry.recurring) parts.push('Recorrente');
  if (entry.status === 'planned') parts.push('Planejado');
  return parts.join(' · ');
}

function HistoryRow({ entry, onPress }: { entry: MonthEntry; onPress: () => void }) {
  const { colors, isDark } = useAppTheme();
  const planned = entry.status === 'planned';
  const income = entry.type === 'income';
  const amountColor = planned ? colors.textSecondary : income ? colors.income : colors.expense;

  return (
    <Pressable
      accessibilityHint="Editar ou excluir"
      accessibilityLabel={`${entry.description}, ${income ? 'receita' : 'despesa'} de ${formatCurrency(entry.amountCents)}`}
      accessibilityRole="button"
      onPress={onPress}
      style={({ pressed }) => [
        styles.row,
        styles.rowCard,
        { backgroundColor: colors.surface, borderColor: colors.border },
        pressed && styles.pressed,
      ]}>
      <View
        style={[
          styles.dot,
          { backgroundColor: entry.categoryId ? categoryColor(entry.categoryId, isDark) : colors.chartMuted },
        ]}
      />
      <View style={styles.flex}>
        <AppText numberOfLines={1}>{entry.description}</AppText>
        <AppText color="secondary" numberOfLines={1} variant="caption">
          {describeEntry(entry)}
        </AppText>
      </View>
      <AppText style={[styles.amount, { color: amountColor }]}>
        {income ? '+' : '−'}
        {formatCurrency(entry.amountCents)}
      </AppText>
    </Pressable>
  );
}

type HistoryTabProps = {
  entries: MonthEntry[];
  monthKey: string;
  onEdit: (entry: MonthEntry) => void;
  onFeedback: (message: string) => void;
  paymentMethods: PaymentMethod[];
};

export function HistoryTab({ entries, monthKey, onEdit, onFeedback, paymentMethods }: HistoryTabProps) {
  const { colors } = useAppTheme();
  const [query, setQuery] = useState('');
  const [exporting, setExporting] = useState(false);
  const [typeFilter, setTypeFilter] = useState<TypeFilter>('all');
  const [filters, setFilters] = useState<HistoryFilters>(emptyHistoryFilters);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const activeFilterCount = (filters.categoryId ? 1 : 0) + (filters.paymentMethodId ? 1 : 0);

  const normalizedQuery = searchable(query.trim());
  const visible = entries
    .filter((entry) => !normalizedQuery || searchable(entry.description).includes(normalizedQuery))
    .filter((entry) => matchesType(entry, typeFilter))
    .filter((entry) => filters.categoryId === null || entry.categoryId === filters.categoryId)
    .filter((entry) => filters.paymentMethodId === null || entry.paymentMethodId === filters.paymentMethodId);

  const days = new Map<string, MonthEntry[]>();
  for (const entry of [...visible].reverse()) {
    days.set(entry.dueDate, [...(days.get(entry.dueDate) ?? []), entry]);
  }

  const exportCsv = async () => {
    if (exporting) return;
    setExporting(true);
    try {
      await exportMonthCsv(entries, monthKey);
    } catch (error: unknown) {
      if (!(error instanceof ExportError)) console.error('Falha ao exportar CSV.', error);
      onFeedback(error instanceof ExportError ? error.message : 'Não foi possível exportar o mês.');
    } finally {
      setExporting(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={styles.filterRow}>
        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons color={colors.textSecondary} name="search-outline" size={16} />
          <TextInput
            accessibilityLabel="Buscar no histórico"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Buscar pela descrição"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            selectionColor={colors.accent}
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
          />
          {query ? (
            <Pressable accessibilityLabel="Limpar busca" hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons color={colors.textSecondary} name="close-circle" size={16} />
            </Pressable>
          ) : null}
        </View>
        <Pressable
          accessibilityLabel="Exportar o mês em CSV"
          accessibilityRole="button"
          disabled={exporting}
          onPress={() => void exportCsv()}
          style={({ pressed }) => [
            styles.filterButton,
            { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          {exporting ? (
            <ActivityIndicator color={colors.accent} size="small" />
          ) : (
            <Ionicons color={colors.text} name="download-outline" size={18} />
          )}
        </Pressable>
      </View>

      <View style={styles.filterRow}>
        <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false} style={styles.flex}>
          {typeFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              onPress={() => setTypeFilter(filter.value)}
              selected={typeFilter === filter.value}
            />
          ))}
        </ScrollView>
        <Pressable
          accessibilityLabel={activeFilterCount > 0 ? `Filtros, ${activeFilterCount} ativos` : 'Filtros'}
          accessibilityRole="button"
          onPress={() => setFiltersOpen(true)}
          style={({ pressed }) => [
            styles.filterButton,
            activeFilterCount > 0
              ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
              : { backgroundColor: colors.surface, borderColor: colors.border },
            pressed && styles.pressed,
          ]}>
          <Ionicons color={activeFilterCount > 0 ? colors.accent : colors.text} name="options-outline" size={18} />
        </Pressable>
      </View>

      {days.size === 0 ? (
        <EmptyNote>
          {entries.length === 0
            ? 'Nenhuma transação neste mês.'
            : normalizedQuery
              ? 'Nenhuma transação encontrada para essa busca.'
              : 'Nenhuma transação com esses filtros.'}
        </EmptyNote>
      ) : (
        [...days].map(([day, dayEntries]) => (
          <View key={day} style={styles.day}>
            <AppText color="secondary" variant="caption">
              {capitalize(dayFormatter.format(parseDateKey(day)))}
            </AppText>
            {dayEntries.map((entry) => (
              <HistoryRow entry={entry} key={entry.key} onPress={() => onEdit(entry)} />
            ))}
          </View>
        ))
      )}

      <HistoryFiltersSheet
        filters={filters}
        onApply={(next) => {
          setFilters(next);
          setFiltersOpen(false);
        }}
        onClose={() => setFiltersOpen(false)}
        paymentMethods={paymentMethods}
        visible={filtersOpen}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  search: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flex: 1,
    flexDirection: 'row',
    gap: 8,
    minHeight: 40,
    paddingHorizontal: 12,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    paddingVertical: 8,
  },
  amount: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 14,
  },
  chips: {
    gap: 7,
    paddingRight: 8,
  },
  container: {
    gap: 14,
  },
  day: {
    gap: 8,
  },
  dot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  filterButton: {
    alignItems: 'center',
    borderRadius: 17,
    borderWidth: 1,
    height: 34,
    justifyContent: 'center',
    width: 34,
  },
  filterRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
  },
  flex: {
    flex: 1,
  },
  pressed: {
    opacity: 0.7,
  },
  rowCard: {
    borderRadius: 18,
    borderWidth: 1,
  },
  row: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 58,
    paddingHorizontal: 14,
    paddingVertical: 10,
  },
});
