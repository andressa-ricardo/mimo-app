import { randomUUID } from 'expo-crypto';
import { useRef, useState } from 'react';
import { View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { CategorySelector } from '@/components/forms/category-selector';
import { CurrencyInput } from '@/components/forms/currency-input';
import { DateField } from '@/components/forms/date-field';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { ToggleField, ToggleGroup } from '@/components/forms/toggle-field';
import { insertTransaction } from '@/database/repositories/finance-repository';
import { MAX_INSTALLMENTS } from '@/features/finance/finance-calculations';
import { findPreset, PRESET_VALUE_PREFIX, unusedPresets } from '@/features/finance/payment-presets';
import { FormError, formStyles } from '@/features/quick-actions/form-parts';
import {
  describeError,
  useCategories,
  usePaymentMethods,
  type QuickSheetProps,
} from '@/features/quick-actions/use-form-options';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import type { TransactionType } from '@/types/finance';
import { toDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';
import { splitInstallments } from '@/utils/money';

function parseInstallments(text: string): number | null {
  if (!/^\d{1,2}$/.test(text)) return null;
  const value = Number(text);
  return value >= 1 && value <= MAX_INSTALLMENTS ? value : null;
}

function describeInstallments(amountCents: number | null, count: number | null): string | null {
  if (amountCents === null || count === null || count < 2 || count > amountCents) return null;
  const parts = splitInstallments(amountCents, count);
  const first = parts[0];
  const last = parts[parts.length - 1];
  return first === last
    ? `${count}x de ${formatCurrency(first)}, uma por mês`
    : `1ª de ${formatCurrency(first)} e demais de ${formatCurrency(last)}, uma por mês`;
}

function TransactionForm({ onSaved }: { onSaved: QuickSheetProps['onSaved'] }) {
  const { colors } = useAppTheme();
  const [transactionId] = useState(() => randomUUID());
  const [initialDate] = useState(() => toDateKey(new Date()));
  const [type, setType] = useState<TransactionType>('expense');
  const [amountCents, setAmountCents] = useState<number | null>(null);
  const [description, setDescription] = useState('');
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [date, setDate] = useState(initialDate);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(null);
  const [installmentsText, setInstallmentsText] = useState('1');
  const [recurring, setRecurring] = useState(false);
  const [planned, setPlanned] = useState(false);
  const [errors, setErrors] = useState<{ amount?: string; description?: string; installments?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { categories, addCategory } = useCategories(type);
  const { methods, addMethod } = usePaymentMethods();

  const isExpense = type === 'expense';
  const installmentCount = isExpense ? parseInstallments(installmentsText) : 1;
  const hasInstallments = installmentCount !== null && installmentCount > 1;
  const typeColor = isExpense ? colors.expense : colors.income;

  useBottomSheetDirty(
    amountCents !== null ||
      description.trim().length > 0 ||
      categoryId !== null ||
      paymentMethodId !== null ||
      date !== initialDate ||
      installmentsText !== '1' ||
      recurring ||
      planned ||
      !isExpense,
  );

  // Picking a suggestion registers it (with type and bank) the first time.
  const selectPaymentMethod = async (value: string | null) => {
    const preset = value ? findPreset(value) : undefined;
    if (!preset) {
      setPaymentMethodId(value);
      return;
    }
    try {
      const method = await addMethod(preset.name, { kind: preset.kind, institution: preset.institution });
      setPaymentMethodId(method.id);
    } catch (error: unknown) {
      setFormError(describeError(error, 'Não foi possível adicionar a forma de pagamento.'));
    }
  };

  const changeType = (next: TransactionType) => {
    setType(next);
    setCategoryId(null);
    if (next === 'income') setInstallmentsText('1');
  };

  const submit = async () => {
    if (savingRef.current) return;
    const normalizedDescription = description.trim();
    const nextErrors: typeof errors = {};
    if (amountCents === null || amountCents <= 0) nextErrors.amount = 'Informe um valor maior que zero.';
    if (!normalizedDescription) nextErrors.description = 'Informe uma descrição.';
    if (installmentCount === null) nextErrors.installments = `Use um número de 1 a ${MAX_INSTALLMENTS}.`;
    else if (amountCents !== null && amountCents > 0 && installmentCount > amountCents) {
      nextErrors.installments = 'O valor é pequeno demais para esse número de parcelas.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || amountCents === null || installmentCount === null) return;

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const isRecurring = recurring && installmentCount === 1;
      await insertTransaction({
        id: transactionId,
        type,
        description: normalizedDescription,
        amountCents,
        categoryId,
        paymentMethodId,
        date,
        installmentCount,
        recurring: isRecurring,
        status: planned ? 'planned' : 'confirmed',
      });
      notifyDataChanged('finance');
      const noun = isExpense ? 'Despesa' : 'Receita';
      onSaved(planned ? `${noun} planejada salva.` : `${noun} salva.`);
    } catch (error: unknown) {
      setFormError(describeError(error, 'Não foi possível salvar a transação. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <BottomSheetScrollView>
        <SegmentedControl
          accessibilityLabel="Tipo de transação"
          onChange={changeType}
          options={[
            { value: 'expense', label: 'Despesa', selectedColor: colors.expense },
            { value: 'income', label: 'Receita', selectedColor: colors.income },
          ]}
          value={type}
        />

        <CurrencyInput
          error={errors.amount}
          label="Valor (R$)"
          large
          onChange={(cents) => {
            setAmountCents(cents);
            if (errors.amount) setErrors((current) => ({ ...current, amount: undefined }));
          }}
          textColor={amountCents === null ? undefined : typeColor}
          value={amountCents}
        />

        <TextField
          error={errors.description}
          label="Descrição"
          maxLength={120}
          onChangeText={(text) => {
            setDescription(text);
            if (errors.description) setErrors((current) => ({ ...current, description: undefined }));
          }}
          placeholder={isExpense ? 'Ex.: Mercado' : 'Ex.: Salário'}
          value={description}
        />

        <CategorySelector
          categories={categories}
          onChange={setCategoryId}
          onCreate={addCategory}
          value={categoryId}
        />

        <View style={formStyles.row}>
          <DateField containerStyle={formStyles.half} label="Data" onChange={setDate} value={date} />
          <SelectField
            addLabel="Outra forma de pagamento"
            addPlaceholder="Ex.: Crédito Sicredi"
            containerStyle={formStyles.half}
            label={isExpense ? 'Pagamento' : 'Recebimento'}
            noneLabel="Não informado"
            onAdd={async (name) => (await addMethod(name)).id}
            onChange={(value) => void selectPaymentMethod(value)}
            options={[
              ...methods.map((method) => ({ value: method.id, label: method.name, group: 'Suas formas' })),
              ...unusedPresets(methods).map((preset) => ({
                value: `${PRESET_VALUE_PREFIX}${preset.key}`,
                label: preset.name,
                group: 'Sugestões',
              })),
            ]}
            value={paymentMethodId}
          />
        </View>

        {isExpense ? (
          <TextField
            error={errors.installments}
            helper={describeInstallments(amountCents, installmentCount)}
            inputMode="numeric"
            keyboardType="number-pad"
            label="Parcelas"
            maxLength={2}
            onChangeText={(text) => {
              setInstallmentsText(text.replace(/\D/g, ''));
              if (errors.installments) setErrors((current) => ({ ...current, installments: undefined }));
            }}
            value={installmentsText}
          />
        ) : null}

        <ToggleGroup>
          <ToggleField
            description={hasInstallments ? 'Indisponível para compras parceladas' : 'Repete todo mês'}
            disabled={hasInstallments}
            label="Recorrente"
            onChange={setRecurring}
            value={recurring && !hasInstallments}
          />
          <ToggleField
            description="Não entra no total gasto até ser confirmado"
            label="Apenas planejado"
            onChange={setPlanned}
            value={planned}
          />
        </ToggleGroup>

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <PrimaryButton label="Salvar" loading={saving} onPress={() => void submit()} />
      </BottomSheetFooter>
    </>
  );
}

export function TransactionQuickSheet({ onClose, onSaved, visible }: QuickSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title="Nova transação" visible={visible}>
      <TransactionForm onSaved={onSaved} />
    </BottomSheet>
  );
}
