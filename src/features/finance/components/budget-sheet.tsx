import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { CategorySelector } from '@/components/forms/category-selector';
import { CurrencyInput } from '@/components/forms/currency-input';
import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import { deleteBudget, saveBudget } from '@/database/repositories/finance-repository';
import { FormError } from '@/features/quick-actions/form-parts';
import { describeError, useCategories } from '@/features/quick-actions/use-form-options';
import { notifyDataChanged } from '@/services/events/data-events';
import type { Budget } from '@/types/finance';

type BudgetSheetProps = {
  /** Set to edit an existing budget; null to create one. */
  budget: Budget | null;
  existingCategoryIds: string[];
  onClose: () => void;
  onSaved: (message: string) => void;
  visible: boolean;
};

function BudgetForm({ budget, existingCategoryIds, onSaved }: Omit<BudgetSheetProps, 'onClose' | 'visible'>) {
  const [categoryId, setCategoryId] = useState<string | null>(budget?.categoryId ?? null);
  const [amountCents, setAmountCents] = useState<number | null>(budget?.amountCents ?? null);
  const [errors, setErrors] = useState<{ category?: string; amount?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { categories, addCategory } = useCategories('expense');
  const available = categories.filter((category) => !existingCategoryIds.includes(category.id));

  useBottomSheetDirty(categoryId !== (budget?.categoryId ?? null) || amountCents !== (budget?.amountCents ?? null));

  const run = async (action: () => Promise<string>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const message = await action();
      notifyDataChanged('finance');
      onSaved(message);
    } catch (error: unknown) {
      setFormError(describeError(error, 'Não foi possível salvar o orçamento. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  const submit = () => {
    const nextErrors: typeof errors = {};
    if (!categoryId) nextErrors.category = 'Escolha uma categoria.';
    if (amountCents === null || amountCents <= 0) nextErrors.amount = 'Informe um limite maior que zero.';
    setErrors(nextErrors);
    if (!categoryId || amountCents === null || Object.keys(nextErrors).length > 0) return;
    void run(async () => {
      await saveBudget(categoryId, amountCents);
      return budget ? 'Orçamento atualizado.' : 'Orçamento criado.';
    });
  };

  return (
    <>
      <BottomSheetScrollView>
        {budget ? (
          <View style={styles.group}>
            <AppText color="secondary" variant="label">
              Categoria
            </AppText>
            <AppText variant="section">{budget.categoryName}</AppText>
          </View>
        ) : (
          <View style={styles.group}>
            <CategorySelector
              categories={available}
              onChange={(id) => {
                setCategoryId(id);
                if (errors.category) setErrors((current) => ({ ...current, category: undefined }));
              }}
              onCreate={addCategory}
              value={categoryId}
            />
            {errors.category ? <FormError message={errors.category} /> : null}
          </View>
        )}

        <CurrencyInput
          error={errors.amount}
          helper="O limite vale para todos os meses."
          label="Limite mensal (R$)"
          large
          onChange={(cents) => {
            setAmountCents(cents);
            if (errors.amount) setErrors((current) => ({ ...current, amount: undefined }));
          }}
          value={amountCents}
        />

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={styles.actions}>
          <PrimaryButton label="Salvar" loading={saving} onPress={submit} />
          {budget ? (
            <PrimaryButton
              disabled={saving}
              label="Remover orçamento"
              onPress={() =>
                void run(async () => {
                  await deleteBudget(budget.categoryId);
                  return 'Orçamento removido.';
                })
              }
              variant="outlined"
            />
          ) : null}
        </View>
      </BottomSheetFooter>
    </>
  );
}

export function BudgetSheet({ budget, onClose, visible, ...props }: BudgetSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title={budget ? 'Editar orçamento' : 'Novo orçamento'} visible={visible}>
      <BudgetForm budget={budget} {...props} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
  },
  group: {
    gap: 6,
  },
});
