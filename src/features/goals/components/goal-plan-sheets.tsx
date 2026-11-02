import { useRef, useState } from 'react';
import { ScrollView, StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { CurrencyInput } from '@/components/forms/currency-input';
import { PrimaryButton } from '@/components/forms/primary-button';
import { TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { FilterChip } from '@/components/ui/filter-chip';
import {
  createGoalSection,
  createSectionItem,
  deleteGoalSection,
  deleteSectionItem,
  updateGoalSection,
  updateSectionItem,
} from '@/database/repositories/goal-plan-repository';
import { FormError } from '@/features/quick-actions/form-parts';
import { describeError } from '@/features/quick-actions/use-form-options';
import { notifyDataChanged } from '@/services/events/data-events';
import type { GoalSection, GoalSectionItem } from '@/types/goals';
import { normalizeUrl } from '@/utils/url';

const blockSuggestions = ['Passagem', 'Hospedagem', 'Passeios', 'Alimentação', 'Transporte', 'Compras', 'Documentos'];

/** Shared save/delete plumbing: one action at a time, errors shown inline. */
function useSheetAction(onSaved: (message: string) => void) {
  const [saving, setSaving] = useState(false);
  const [formError, setFormError] = useState<string | null>(null);
  const savingRef = useRef(false);

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
      setFormError(describeError(error, 'Não foi possível salvar. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  return { saving, formError, run };
}

type BlockFormProps = {
  goalId: string;
  onSaved: (message: string) => void;
  section: GoalSection | null;
};

function BlockForm({ goalId, onSaved, section }: BlockFormProps) {
  const [title, setTitle] = useState(section?.title ?? '');
  const [amountCents, setAmountCents] = useState<number | null>(section?.plannedAmountCents ?? null);
  const [titleError, setTitleError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { saving, formError, run } = useSheetAction(onSaved);

  useBottomSheetDirty(title.trim() !== (section?.title ?? '') || amountCents !== (section?.plannedAmountCents ?? null));

  const submit = () => {
    const normalized = title.trim();
    if (!normalized) {
      setTitleError('Dê um nome ao bloco.');
      return;
    }
    const planned = amountCents && amountCents > 0 ? amountCents : null;
    void run(async () => {
      if (section) await updateGoalSection(section.id, normalized, planned);
      else await createGoalSection(goalId, normalized, planned);
      return section ? 'Bloco atualizado.' : 'Bloco criado.';
    });
  };

  return (
    <>
      <BottomSheetScrollView>
        {section ? null : (
          <ScrollView contentContainerStyle={styles.chips} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
            {blockSuggestions.map((suggestion) => (
              <FilterChip
                key={suggestion}
                label={suggestion}
                onPress={() => {
                  setTitle(suggestion);
                  setTitleError(null);
                }}
                selected={title === suggestion}
              />
            ))}
          </ScrollView>
        )}
        <TextField
          error={titleError}
          label="Nome do bloco"
          maxLength={60}
          onChangeText={(text) => {
            setTitle(text);
            if (titleError) setTitleError(null);
          }}
          placeholder="Ex.: Hotel, Passagem de avião"
          value={title}
        />
        <CurrencyInput
          helper="Quanto da meta você quer reservar para isso. Opcional."
          label="Valor reservado (R$)"
          onChange={setAmountCents}
          value={amountCents}
        />
        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={styles.actions}>
          <PrimaryButton label={section ? 'Salvar bloco' : 'Criar bloco'} loading={saving} onPress={submit} />
          {section ? (
            <PrimaryButton disabled={saving} label="Excluir bloco" onPress={() => setConfirmDelete(true)} variant="outlined" />
          ) : null}
        </View>
      </BottomSheetFooter>
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={saving}
        message={`"${section?.title ?? ''}" e todas as ideias dentro dele serão apagados. O dinheiro guardado na meta não muda.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          void run(async () => {
            if (section) await deleteGoalSection(section.id);
            return 'Bloco excluído.';
          })
        }
        title="Excluir bloco?"
        tone="destructive"
        visible={confirmDelete}
      />
    </>
  );
}

type IdeaFormProps = {
  item: GoalSectionItem | null;
  onSaved: (message: string) => void;
  section: GoalSection;
};

function IdeaForm({ item, onSaved, section }: IdeaFormProps) {
  const [title, setTitle] = useState(item?.title ?? '');
  const [url, setUrl] = useState(item?.url ?? '');
  const [priceCents, setPriceCents] = useState<number | null>(item?.priceCents ?? null);
  const [note, setNote] = useState(item?.note ?? '');
  const [errors, setErrors] = useState<{ title?: string; url?: string }>({});
  const [confirmDelete, setConfirmDelete] = useState(false);
  const { saving, formError, run } = useSheetAction(onSaved);

  useBottomSheetDirty(
    title.trim() !== (item?.title ?? '') ||
      url.trim() !== (item?.url ?? '') ||
      priceCents !== (item?.priceCents ?? null) ||
      note.trim() !== (item?.note ?? ''),
  );

  const submit = () => {
    const normalizedTitle = title.trim();
    const link = normalizeUrl(url);
    const nextErrors: typeof errors = {};
    if (!normalizedTitle) nextErrors.title = 'Dê um nome à ideia.';
    if (!link.valid) nextErrors.url = 'Informe um link válido.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    const input = { title: normalizedTitle, url: link.value, priceCents, note: note.trim() || null };
    void run(async () => {
      if (item) await updateSectionItem(item.id, input);
      else await createSectionItem(section.id, input);
      return item ? 'Ideia atualizada.' : 'Ideia adicionada.';
    });
  };

  return (
    <>
      <BottomSheetScrollView>
        <AppText color="secondary" variant="caption">
          Bloco: {section.title}
        </AppText>
        <TextField
          error={errors.title}
          label="Nome"
          maxLength={100}
          onChangeText={(text) => {
            setTitle(text);
            if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
          }}
          placeholder="Ex.: Hotel Lotte Myeongdong"
          value={title}
        />
        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.url}
          inputMode="url"
          keyboardType="url"
          label="Link (opcional)"
          maxLength={2048}
          onChangeText={(text) => {
            setUrl(text);
            if (errors.url) setErrors((current) => ({ ...current, url: undefined }));
          }}
          placeholder="https://"
          value={url}
        />
        <CurrencyInput label="Preço (opcional)" onChange={setPriceCents} value={priceCents} />
        <TextField
          label="Observação (opcional)"
          maxLength={500}
          multiline
          onChangeText={setNote}
          placeholder="Ex.: café da manhã incluso, perto do metrô"
          value={note}
        />
        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <View style={styles.actions}>
          <PrimaryButton label={item ? 'Salvar ideia' : 'Adicionar ideia'} loading={saving} onPress={submit} />
          {item ? (
            <PrimaryButton disabled={saving} label="Excluir ideia" onPress={() => setConfirmDelete(true)} variant="outlined" />
          ) : null}
        </View>
      </BottomSheetFooter>
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={saving}
        message={`"${item?.title ?? ''}" será removida deste bloco.`}
        onCancel={() => setConfirmDelete(false)}
        onConfirm={() =>
          void run(async () => {
            if (item) await deleteSectionItem(item.id);
            return 'Ideia excluída.';
          })
        }
        title="Excluir ideia?"
        tone="destructive"
        visible={confirmDelete}
      />
    </>
  );
}

export type PlanSheetState =
  | { kind: 'block'; section: GoalSection | null }
  | { kind: 'idea'; section: GoalSection; item: GoalSectionItem | null };

type GoalPlanSheetProps = {
  goalId: string;
  onClose: () => void;
  onSaved: (message: string) => void;
  state: PlanSheetState | null;
};

export function GoalPlanSheet({ goalId, onClose, onSaved, state }: GoalPlanSheetProps) {
  // Keep the last content while the sheet animates out after `state` is cleared.
  const [shown, setShown] = useState<PlanSheetState | null>(null);
  if (state && state !== shown) setShown(state);

  const title = !shown
    ? ''
    : shown.kind === 'block'
      ? shown.section
        ? 'Editar bloco'
        : 'Novo bloco'
      : shown.item
        ? 'Editar ideia'
        : 'Nova ideia';

  return (
    <BottomSheet onRequestClose={onClose} title={title} visible={state !== null}>
      {!shown ? null : shown.kind === 'block' ? (
        <BlockForm goalId={goalId} onSaved={onSaved} section={shown.section} />
      ) : (
        <IdeaForm item={shown.item} onSaved={onSaved} section={shown.section} />
      )}
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
});
