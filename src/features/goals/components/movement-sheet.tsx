import { useRef, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { CurrencyInput } from '@/components/forms/currency-input';
import { DateField } from '@/components/forms/date-field';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import {
  addMovement,
  deleteMovement,
  GoalError,
  updateMovement,
} from '@/database/repositories/goals-repository';
import { goalProgress } from '@/features/goals/goal-math';
import { FormError } from '@/features/quick-actions/form-parts';
import { describeError } from '@/features/quick-actions/use-form-options';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import type { Goal, GoalMovement, GoalMovementType } from '@/types/goals';
import { toDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

export type MovementSheetMode = { kind: GoalMovementType } | { kind: 'edit'; movement: GoalMovement };

type MovementFormProps = {
  goal: Goal;
  mode: MovementSheetMode;
  onSaved: (message: string) => void;
};

function signed(type: GoalMovementType, cents: number): number {
  return type === 'contribution' ? cents : -cents;
}

function MovementForm({ goal, mode, onSaved }: MovementFormProps) {
  const { colors } = useAppTheme();
  const editing = mode.kind === 'edit' ? mode.movement : null;
  const [initial] = useState(() => ({
    type: editing?.type ?? (mode.kind === 'edit' ? 'contribution' : mode.kind),
    amountCents: editing?.amountCents ?? null,
    date: editing?.date ?? toDateKey(new Date()),
    note: editing?.note ?? '',
  }));
  const [type, setType] = useState<GoalMovementType>(initial.type);
  const [amountCents, setAmountCents] = useState<number | null>(initial.amountCents);
  const [date, setDate] = useState(initial.date);
  const [note, setNote] = useState(initial.note);
  const [amountError, setAmountError] = useState<string | null>(null);
  const [formError, setFormError] = useState<string | null>(null);
  const [confirm, setConfirm] = useState<'withdraw' | 'delete' | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);

  // Balance without this movement, then with the new values applied.
  const baseBalance = goal.savedAmountCents - (editing ? signed(editing.type, editing.amountCents) : 0);
  const projected = baseBalance + (amountCents ? signed(type, amountCents) : 0);
  const projectedProgress = goalProgress(projected, goal.targetAmountCents);
  const isWithdrawal = type === 'withdrawal';
  const exceedsBalance = isWithdrawal && amountCents !== null && amountCents > baseBalance;

  useBottomSheetDirty(
    type !== initial.type || amountCents !== initial.amountCents || date !== initial.date || note.trim() !== initial.note,
  );

  const run = async (action: () => Promise<string>) => {
    if (savingRef.current) return;
    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const message = await action();
      notifyDataChanged('goals');
      onSaved(message);
    } catch (error: unknown) {
      setConfirm(null);
      setFormError(
        error instanceof GoalError ? error.message : describeError(error, 'Não foi possível salvar. Tente novamente.'),
      );
      savingRef.current = false;
      setSaving(false);
    }
  };

  const save = () =>
    run(async () => {
      if (amountCents === null) throw new GoalError('Informe um valor.');
      const input = { type, amountCents, date, note: note.trim() || null };
      if (editing) {
        await updateMovement(editing.id, input);
        return 'Lançamento atualizado.';
      }
      await addMovement(goal.id, input);
      if (isWithdrawal) return `${formatCurrency(amountCents)} retirados da meta.`;
      return projected >= goal.targetAmountCents && baseBalance < goal.targetAmountCents
        ? 'Meta concluída! 🎉'
        : `${formatCurrency(amountCents)} adicionados à meta.`;
    });

  const submit = () => {
    if (amountCents === null || amountCents <= 0) {
      setAmountError('Informe um valor maior que zero.');
      return;
    }
    if (exceedsBalance) {
      setAmountError(`Você tem ${formatCurrency(Math.max(baseBalance, 0))} guardados nesta meta.`);
      return;
    }
    // Withdrawals are confirmed before they touch the balance.
    if (isWithdrawal && !editing) setConfirm('withdraw');
    else void save();
  };

  const buttonLabel = editing
    ? 'Salvar alterações'
    : `${isWithdrawal ? 'Retirar' : 'Adicionar'} ${formatCurrency(amountCents ?? 0)}`;

  return (
    <>
      <BottomSheetScrollView>
        <View style={[styles.summary, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <AppText numberOfLines={1} variant="label">
            {goal.icon ? `${goal.icon} ` : ''}
            {goal.title}
          </AppText>
          <AppText color="secondary" variant="caption">
            Saldo atual: {formatCurrency(goal.savedAmountCents)} de {formatCurrency(goal.targetAmountCents)}
          </AppText>
        </View>

        {editing ? (
          <SegmentedControl
            accessibilityLabel="Tipo do lançamento"
            onChange={setType}
            options={[
              { value: 'contribution', label: 'Aporte', selectedColor: colors.income },
              { value: 'withdrawal', label: 'Retirada', selectedColor: colors.expense },
            ]}
            value={type}
          />
        ) : null}

        <CurrencyInput
          error={amountError}
          label="Valor (R$)"
          large
          onChange={(cents) => {
            setAmountCents(cents);
            if (amountError) setAmountError(null);
          }}
          textColor={amountCents === null ? undefined : isWithdrawal ? colors.expense : colors.income}
          value={amountCents}
        />

        <DateField label="Data" onChange={setDate} value={date} />

        <TextField
          label={isWithdrawal ? 'Motivo (opcional)' : 'Observação (opcional)'}
          maxLength={200}
          onChangeText={setNote}
          placeholder={isWithdrawal ? 'Ex.: Imprevisto no mês' : 'Ex.: Sobra do salário'}
          value={note}
        />

        {amountCents !== null && amountCents > 0 && !exceedsBalance ? (
          <View style={[styles.projection, { backgroundColor: colors.muted }]}>
            <AppText color="secondary" variant="caption">
              {isWithdrawal ? 'Saldo restante' : 'Novo saldo'}
            </AppText>
            <AppText variant="label">
              {formatCurrency(projected)} · {projectedProgress.percent}% da meta
            </AppText>
          </View>
        ) : null}

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={styles.actions}>
          <PrimaryButton label={buttonLabel} loading={saving && confirm === null} onPress={submit} />
          {editing ? (
            <PrimaryButton
              disabled={saving}
              label="Excluir lançamento"
              onPress={() => setConfirm('delete')}
              variant="outlined"
            />
          ) : null}
        </View>
      </BottomSheetFooter>

      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Retirar"
        loading={saving}
        message={`Retirar ${formatCurrency(amountCents ?? 0)} de "${goal.title}"? O saldo da meta ficará em ${formatCurrency(projected)}.`}
        onCancel={() => setConfirm(null)}
        onConfirm={() => void save()}
        title="Confirmar retirada?"
        tone="destructive"
        visible={confirm === 'withdraw'}
      />
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={saving}
        message="O lançamento será removido do histórico e o saldo da meta será recalculado."
        onCancel={() => setConfirm(null)}
        onConfirm={() =>
          void run(async () => {
            if (editing) await deleteMovement(editing.id);
            return 'Lançamento excluído.';
          })
        }
        title="Excluir lançamento?"
        tone="destructive"
        visible={confirm === 'delete'}
      />
    </>
  );
}

const titles: Record<MovementSheetMode['kind'], string> = {
  contribution: 'Adicionar à meta',
  withdrawal: 'Retirar da meta',
  edit: 'Editar lançamento',
};

type MovementSheetProps = {
  goal: Goal | null;
  mode: MovementSheetMode | null;
  onClose: () => void;
  onSaved: (message: string) => void;
};

export function MovementSheet({ goal, mode, onClose, onSaved }: MovementSheetProps) {
  // Keep the last content while the sheet animates out after `mode` is cleared.
  const [shown, setShown] = useState<{ goal: Goal; mode: MovementSheetMode } | null>(null);
  if (goal && mode && (shown?.goal !== goal || shown.mode !== mode)) setShown({ goal, mode });

  return (
    <BottomSheet
      onRequestClose={onClose}
      title={shown ? titles[shown.mode.kind] : ''}
      visible={goal !== null && mode !== null}>
      {shown ? <MovementForm goal={shown.goal} mode={shown.mode} onSaved={onSaved} /> : null}
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
  },
  projection: {
    alignItems: 'center',
    borderRadius: 14,
    flexDirection: 'row',
    justifyContent: 'space-between',
    padding: 12,
  },
  summary: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 2,
    padding: 12,
  },
});
