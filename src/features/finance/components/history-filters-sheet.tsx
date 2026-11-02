import { useState, type ReactNode } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import { BottomSheet, BottomSheetFooter, BottomSheetScrollView } from '@/components/forms/bottom-sheet';
import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import { FilterChip } from '@/components/ui/filter-chip';
import { useCategories } from '@/features/quick-actions/use-form-options';
import type { PaymentMethod } from '@/types/categories';

export type HistoryFilters = { categoryId: string | null; paymentMethodId: string | null };

export const emptyHistoryFilters: HistoryFilters = { categoryId: null, paymentMethodId: null };

type HistoryFiltersSheetProps = {
  filters: HistoryFilters;
  onApply: (filters: HistoryFilters) => void;
  onClose: () => void;
  paymentMethods: PaymentMethod[];
  visible: boolean;
};

function ChipRow({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.group}>
      <AppText color="secondary" variant="label">
        {label}
      </AppText>
      <ScrollView contentContainerStyle={styles.chips} horizontal showsHorizontalScrollIndicator={false}>
        {children}
      </ScrollView>
    </View>
  );
}

function FiltersForm({ filters, onApply, paymentMethods }: Omit<HistoryFiltersSheetProps, 'onClose' | 'visible'>) {
  const [draft, setDraft] = useState(filters);
  const { categories: expenseCategories } = useCategories('expense');
  const { categories: incomeCategories } = useCategories('income');
  const categories = [...expenseCategories, ...incomeCategories];

  return (
    <>
      <BottomSheetScrollView>
        <ChipRow label="Categoria">
          <FilterChip
            label="Todas"
            onPress={() => setDraft((current) => ({ ...current, categoryId: null }))}
            selected={draft.categoryId === null}
          />
          {categories.map((category) => (
            <FilterChip
              key={category.id}
              label={category.name}
              onPress={() => setDraft((current) => ({ ...current, categoryId: category.id }))}
              selected={draft.categoryId === category.id}
            />
          ))}
        </ChipRow>

        <ChipRow label="Pagamento">
          <FilterChip
            label="Todos"
            onPress={() => setDraft((current) => ({ ...current, paymentMethodId: null }))}
            selected={draft.paymentMethodId === null}
          />
          {paymentMethods.map((method) => (
            <FilterChip
              key={method.id}
              label={method.name}
              onPress={() => setDraft((current) => ({ ...current, paymentMethodId: method.id }))}
              selected={draft.paymentMethodId === method.id}
            />
          ))}
        </ChipRow>

        <AppText color="secondary" variant="caption">
          Use as setas de mês acima para filtrar por período.
        </AppText>
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={styles.actions}>
          <View style={styles.flex}>
            <PrimaryButton label="Limpar" onPress={() => setDraft(emptyHistoryFilters)} variant="outlined" />
          </View>
          <View style={styles.flex}>
            <PrimaryButton label="Aplicar" onPress={() => onApply(draft)} />
          </View>
        </View>
      </BottomSheetFooter>
    </>
  );
}

export function HistoryFiltersSheet({ onClose, visible, ...props }: HistoryFiltersSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title="Filtros" visible={visible}>
      <FiltersForm {...props} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
  },
  chips: {
    gap: 7,
  },
  flex: {
    flex: 1,
  },
  group: {
    gap: 8,
  },
});
