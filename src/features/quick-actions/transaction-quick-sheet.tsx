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
import { DateField, OptionalDateField } from '@/components/forms/date-field';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { SelectField } from '@/components/forms/select-field';
import { TextField } from '@/components/forms/text-field';
import { ToggleField, ToggleGroup } from '@/components/forms/toggle-field';
import { ChoiceDialog } from '@/components/ui/choice-dialog';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  deleteTransaction,
  endRecurringSeries,
  insertTransaction,
  updateTransaction,
} from '@/database/repositories/finance-repository';
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
import type { NewTransactionInput, TransactionType } from '@/types/finance';
import { addDaysToDateKey, formatDateKey, toDateKey, type DateKey } from '@/utils/date';
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

/** Editing context: the stored transaction and the occurrence that was tapped. */
export type TransactionEdit = { transaction: NewTransactionInput; occurrenceDate: DateKey };

type TransactionFormProps = {
  edit: TransactionEdit | null;
  initialType: TransactionType;
  onSaved: QuickSheetProps['onSaved'];
};

function TransactionForm({ edit, initialType, onSaved }: TransactionFormProps) {
  const { colors } = useAppTheme();
  const existing = edit?.transaction ?? null;
  const [transactionId] = useState(() => existing?.id ?? randomUUID());
  const [initial] = useState(() => ({
    type: existing?.type ?? initialType,
    amountCents: existing?.amountCents ?? null,
    description: existing?.description ?? '',
    categoryId: existing?.categoryId ?? null,
    date: existing?.date ?? toDateKey(new Date()),
    paymentMethodId: existing?.paymentMethodId ?? null,
    installmentsText: String(existing?.installmentCount ?? 1),
    recurring: existing?.recurring ?? false,
    recurrenceEndDate: existing?.recurrenceEndDate ?? null,
    planned: existing?.status === 'planned',
  }));
  const [type, setType] = useState<TransactionType>(initial.type);
  const [amountCents, setAmountCents] = useState<number | null>(initial.amountCents);
  const [description, setDescription] = useState(initial.description);
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [date, setDate] = useState(initial.date);
  const [paymentMethodId, setPaymentMethodId] = useState<string | null>(initial.paymentMethodId);
  const [installmentsText, setInstallmentsText] = useState(initial.installmentsText);
  const [recurring, setRecurring] = useState(initial.recurring);
  const [recurrenceEndDate, setRecurrenceEndDate] = useState<DateKey | null>(initial.recurrenceEndDate);
  const [planned, setPlanned] = useState(initial.planned);
  const [errors, setErrors] = useState<{ amount?: string; description?: string; installments?: string; end?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'delete' | 'series' | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { categories, addCategory } = useCategories(type);
  const { methods, addMethod } = usePaymentMethods();

  const isExpense = type === 'expense';
  const installmentCount = isExpense ? parseInstallments(installmentsText) : 1;
  const hasInstallments = installmentCount !== null && installmentCount > 1;
  const isRecurring = recurring && !hasInstallments;
  const typeColor = isExpense ? colors.expense : colors.income;
  const noun = isExpense ? 'Despesa' : 'Receita';

  useBottomSheetDirty(
    amountCents !== initial.amountCents ||
      description.trim() !== initial.description ||
      categoryId !== initial.categoryId ||
      paymentMethodId !== initial.paymentMethodId ||
      date !== initial.date ||
      installmentsText !== initial.installmentsText ||
      recurring !== initial.recurring ||
      recurrenceEndDate !== initial.recurrenceEndDate ||
      planned !== initial.planned ||
      type !== initial.type,
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
      setConfirm(null);
      setFormError(describeError(error, 'Não foi possível salvar a transação. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  const submit = () => {
    const normalizedDescription = description.trim();
    const nextErrors: typeof errors = {};
    if (amountCents === null || amountCents <= 0) nextErrors.amount = 'Informe um valor maior que zero.';
    if (!normalizedDescription) nextErrors.description = 'Informe uma descrição.';
    if (installmentCount === null) nextErrors.installments = `Use um número de 1 a ${MAX_INSTALLMENTS}.`;
    else if (amountCents !== null && amountCents > 0 && installmentCount > amountCents) {
      nextErrors.installments = 'O valor é pequeno demais para esse número de parcelas.';
    }
    if (isRecurring && recurrenceEndDate !== null && recurrenceEndDate < date) {
      nextErrors.end = 'O fim da repetição não pode ser antes da data.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || amountCents === null || installmentCount === null) return;

    const input: NewTransactionInput = {
      id: transactionId,
      type,
      description: normalizedDescription,
      amountCents,
      categoryId,
      paymentMethodId,
      date,
      installmentCount,
      recurring: isRecurring,
      recurrenceEndDate: isRecurring ? recurrenceEndDate : null,
      status: planned ? 'planned' : 'confirmed',
    };
    void run(async () => {
      if (existing) {
        await updateTransaction(input);
        return `${noun} atualizada.`;
      }
      await insertTransaction(input);
      return planned ? `${noun} planejada salva.` : `${noun} salva.`;
    });
  };

  // Ending a series from a later occurrence keeps everything before it.
  const canEndSeries = existing?.recurring === true && edit !== null && edit.occurrenceDate > existing.date;

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
          helper={existing?.recurring ? 'Valor de cada ocorrência.' : existing && existing.installmentCount > 1 ? 'Valor total da compra.' : null}
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

        <CategorySelector categories={categories} onChange={setCategoryId} onCreate={addCategory} value={categoryId} />

        <View style={formStyles.row}>
          <DateField
            containerStyle={formStyles.half}
            label={existing?.recurring || (existing && existing.installmentCount > 1) ? 'Primeira data' : 'Data'}
            onChange={setDate}
            value={date}
          />
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
            value={isRecurring}
          />
          <ToggleField
            description="Não entra no total gasto até ser confirmado"
            label="Apenas planejado"
            onChange={setPlanned}
            value={planned}
          />
        </ToggleGroup>

        {isRecurring ? (
          <View style={formStyles.group}>
            <OptionalDateField
              label="Repetir até (opcional)"
              onChange={(value) => {
                setRecurrenceEndDate(value);
                if (errors.end) setErrors((current) => ({ ...current, end: undefined }));
              }}
              placeholder="Sem data final"
              value={recurrenceEndDate}
            />
            {errors.end ? <FormError message={errors.end} /> : null}
          </View>
        ) : null}

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={formStyles.group}>
          <PrimaryButton label="Salvar" loading={saving && confirm === null} onPress={submit} />
          {existing ? (
            <PrimaryButton
              disabled={saving}
              icon="trash-outline"
              label={existing.recurring ? 'Excluir ou encerrar' : 'Excluir'}
              onPress={() => setConfirm(existing.recurring ? 'series' : 'delete')}
              variant="outlined"
            />
          ) : null}
        </View>
      </BottomSheetFooter>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={saving}
        message={
          existing && existing.installmentCount > 1
            ? `As ${existing.installmentCount} parcelas de "${existing.description}" serão excluídas.`
            : `"${existing?.description ?? ''}" será excluída do histórico.`
        }
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          void run(async () => {
            if (existing) await deleteTransaction(existing.id);
            return `${noun} excluída.`;
          })
        }
        title="Excluir transação?"
        tone="destructive"
        visible={confirm === 'delete'}
      />
      <ChoiceDialog
        choices={[
          ...(canEndSeries && edit
            ? [
                {
                  label: `Encerrar a partir de ${formatDateKey(edit.occurrenceDate)}`,
                  onPress: () =>
                    void run(async () => {
                      await endRecurringSeries(edit.transaction.id, addDaysToDateKey(edit.occurrenceDate, -1));
                      return 'Repetição encerrada. Os meses anteriores foram mantidos.';
                    }),
                },
              ]
            : []),
          {
            label: 'Excluir toda a série',
            tone: 'destructive' as const,
            onPress: () =>
              void run(async () => {
                if (existing) await deleteTransaction(existing.id);
                return 'Série excluída.';
              }),
          },
        ]}
        loading={saving}
        message={
          canEndSeries
            ? 'Encerrar mantém os lançamentos anteriores no histórico. Excluir apaga a série inteira.'
            : 'Toda a série será apagada, inclusive os meses anteriores.'
        }
        onCancel={() => setConfirm(null)}
        title="Transação recorrente"
        visible={confirm === 'series'}
      />
    </>
  );
}

type TransactionQuickSheetProps = QuickSheetProps & {
  /** When set, the sheet edits this transaction. */
  edit?: TransactionEdit | null;
  /** Which segment starts selected (Despesa by default). */
  initialType?: TransactionType;
};

export function TransactionQuickSheet({
  edit = null,
  initialType = 'expense',
  onClose,
  onSaved,
  visible,
}: TransactionQuickSheetProps) {
  // Keep the last content while the sheet animates out after `edit` is cleared.
  const [shownEdit, setShownEdit] = useState<TransactionEdit | null>(null);
  if (edit && edit !== shownEdit) setShownEdit(edit);
  if (visible && !edit && shownEdit) setShownEdit(null);
  const current = visible ? edit : shownEdit;

  return (
    <BottomSheet onRequestClose={onClose} title={current ? 'Editar transação' : 'Nova transação'} visible={visible}>
      <TransactionForm edit={current} initialType={initialType} onSaved={onSaved} />
    </BottomSheet>
  );
}
