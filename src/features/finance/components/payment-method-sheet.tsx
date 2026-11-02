import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { FilterChip } from '@/components/ui/filter-chip';
import {
  archivePaymentMethod,
  createPaymentMethod,
  updatePaymentMethod,
} from '@/database/repositories/categories-repository';
import { paymentKindLabels, unusedPresets, type PaymentPreset } from '@/features/finance/payment-presets';
import { FormError } from '@/features/quick-actions/form-parts';
import { describeError } from '@/features/quick-actions/use-form-options';
import { notifyDataChanged } from '@/services/events/data-events';
import type { PaymentMethod, PaymentMethodKind } from '@/types/categories';

const kindOptions = (['credit', 'debit', 'pix', 'cash', 'other'] as const).map((kind) => ({
  value: kind,
  label: paymentKindLabels[kind],
}));

type PaymentMethodSheetProps = {
  existing: PaymentMethod[];
  /** Set to edit; null to create. */
  method: PaymentMethod | null;
  onClose: () => void;
  onSaved: (message: string) => void;
  visible: boolean;
};

function PaymentMethodForm({ existing, method, onSaved }: Omit<PaymentMethodSheetProps, 'onClose' | 'visible'>) {
  const [name, setName] = useState(method?.name ?? '');
  const [kind, setKind] = useState<PaymentMethodKind>(method?.kind ?? 'credit');
  const [institution, setInstitution] = useState(method?.institution ?? '');
  const [dueDayText, setDueDayText] = useState(method?.dueDay ? String(method.dueDay) : '');
  const [errors, setErrors] = useState<{ name?: string; dueDay?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const suggestions = method ? [] : unusedPresets(existing);

  useBottomSheetDirty(
    name.trim() !== (method?.name ?? '') ||
      kind !== (method?.kind ?? 'credit') ||
      institution.trim() !== (method?.institution ?? '') ||
      dueDayText !== (method?.dueDay ? String(method.dueDay) : ''),
  );

  const applyPreset = (preset: PaymentPreset) => {
    setName(preset.name);
    setKind(preset.kind);
    setInstitution(preset.institution ?? '');
    setErrors({});
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
      setFormError(
        error instanceof Error && /^(Já existe|Use|Informe)/.test(error.message)
          ? error.message
          : describeError(error, 'Não foi possível salvar. Tente novamente.'),
      );
      savingRef.current = false;
      setSaving(false);
    }
  };

  const submit = () => {
    const nextErrors: typeof errors = {};
    if (!name.trim()) nextErrors.name = 'Informe um nome.';
    const dueDay = kind === 'credit' && dueDayText ? Number(dueDayText) : null;
    if (dueDay !== null && (!Number.isInteger(dueDay) || dueDay < 1 || dueDay > 31)) {
      nextErrors.dueDay = 'Use um dia entre 1 e 31.';
    }
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const details = { kind, institution: institution.trim() || null, dueDay };
    void run(async () => {
      if (method) {
        await updatePaymentMethod(method.id, name, details);
        return 'Forma de pagamento atualizada.';
      }
      await createPaymentMethod(name, details);
      return 'Forma de pagamento adicionada.';
    });
  };

  return (
    <>
      <BottomSheetScrollView>
        {suggestions.length > 0 ? (
          <View style={styles.group}>
            <AppText color="secondary" variant="label">
              Sugestões
            </AppText>
            <ScrollView
              contentContainerStyle={styles.chips}
              horizontal
              keyboardShouldPersistTaps="handled"
              showsHorizontalScrollIndicator={false}>
              {suggestions.map((preset) => (
                <FilterChip
                  key={preset.key}
                  label={preset.name}
                  onPress={() => applyPreset(preset)}
                  selected={name === preset.name}
                />
              ))}
            </ScrollView>
          </View>
        ) : null}

        <TextField
          error={errors.name}
          label="Nome"
          maxLength={40}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
          }}
          placeholder="Ex.: Crédito Nubank"
          value={name}
        />

        <View style={styles.group}>
          <AppText color="secondary" variant="label">
            Tipo
          </AppText>
          <SegmentedControl accessibilityLabel="Tipo" onChange={setKind} options={kindOptions} value={kind} />
        </View>

        {kind === 'credit' || kind === 'debit' || kind === 'pix' ? (
          <TextField
            label="Banco (opcional)"
            maxLength={40}
            onChangeText={setInstitution}
            placeholder="Ex.: Nubank"
            value={institution}
          />
        ) : null}

        {kind === 'credit' ? (
          <TextField
            error={errors.dueDay}
            helper="Dia do mês em que a fatura vence."
            inputMode="numeric"
            keyboardType="number-pad"
            label="Vencimento (opcional)"
            maxLength={2}
            onChangeText={(text) => {
              setDueDayText(text.replace(/\D/g, ''));
              if (errors.dueDay) setErrors((current) => ({ ...current, dueDay: undefined }));
            }}
            placeholder="Ex.: 10"
            value={dueDayText}
          />
        ) : null}

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={styles.actions}>
          <PrimaryButton label="Salvar" loading={saving} onPress={submit} />
          {method ? (
            <PrimaryButton
              disabled={saving}
              label="Remover forma de pagamento"
              onPress={() =>
                void run(async () => {
                  await archivePaymentMethod(method.id);
                  return 'Forma de pagamento removida. As transações antigas foram mantidas.';
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

export function PaymentMethodSheet({ method, onClose, visible, ...props }: PaymentMethodSheetProps) {
  return (
    <BottomSheet
      onRequestClose={onClose}
      title={method ? 'Editar forma de pagamento' : 'Nova forma de pagamento'}
      visible={visible}>
      <PaymentMethodForm method={method} {...props} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 8,
  },
  chips: {
    gap: 7,
  },
  group: {
    gap: 7,
  },
});
