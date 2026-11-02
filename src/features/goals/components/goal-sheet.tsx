import { randomUUID } from 'expo-crypto';
import { useEffect, useRef, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { CategorySelector } from '@/components/forms/category-selector';
import { CurrencyInput } from '@/components/forms/currency-input';
import { OptionalDateField } from '@/components/forms/date-field';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SelectField } from '@/components/forms/select-field';
import { FormField, TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { createGoal, updateGoal } from '@/database/repositories/goals-repository';
import { listWishlistItems } from '@/database/repositories/wishlist-repository';
import { goalIcons } from '@/features/goals/goal-math';
import { FormError, formStyles } from '@/features/quick-actions/form-parts';
import { describeError, useCategories } from '@/features/quick-actions/use-form-options';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import type { Goal } from '@/types/goals';
import type { WishlistItem } from '@/types/wishlist';
import { toDateKey, type DateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

/** Pre-filled values when a goal is created from somewhere else (e.g. a wishlist item). */
export type GoalDraft = {
  title?: string;
  targetAmountCents?: number | null;
  icon?: string | null;
  linkedWishlistItemId?: string | null;
};

type GoalFormProps = {
  draft: GoalDraft | null;
  goal: Goal | null;
  onSaved: (message: string, goalId: string) => void;
};

function useWishlistOptions(): WishlistItem[] {
  const [items, setItems] = useState<WishlistItem[]>([]);
  useEffect(() => {
    let active = true;
    listWishlistItems()
      .then((loaded) => {
        if (active) setItems(loaded);
      })
      .catch((error: unknown) => console.warn('Falha ao carregar desejos.', error));
    return () => {
      active = false;
    };
  }, []);
  return items;
}

function GoalForm({ draft, goal, onSaved }: GoalFormProps) {
  const { colors } = useAppTheme();
  const [goalId] = useState(() => goal?.id ?? randomUUID());
  const [initial] = useState(() => ({
    title: goal?.title ?? draft?.title ?? '',
    targetAmountCents: goal?.targetAmountCents ?? draft?.targetAmountCents ?? null,
    targetDate: goal?.targetDate ?? null,
    icon: goal?.icon ?? draft?.icon ?? null,
    categoryId: goal?.categoryId ?? null,
    description: goal?.description ?? '',
    linkedWishlistItemId: goal?.linkedWishlistItemId ?? draft?.linkedWishlistItemId ?? null,
  }));
  const [title, setTitle] = useState(initial.title);
  const [targetAmountCents, setTargetAmountCents] = useState<number | null>(initial.targetAmountCents);
  const [initialSavedCents, setInitialSavedCents] = useState<number | null>(null);
  const [targetDate, setTargetDate] = useState<DateKey | null>(initial.targetDate);
  const [icon, setIcon] = useState<string | null>(initial.icon);
  const [categoryId, setCategoryId] = useState<string | null>(initial.categoryId);
  const [description, setDescription] = useState(initial.description);
  const [linkedWishlistItemId, setLinkedWishlistItemId] = useState<string | null>(initial.linkedWishlistItemId);
  const [errors, setErrors] = useState<{ title?: string; target?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const { categories, addCategory } = useCategories('goal');
  const wishlistItems = useWishlistOptions();
  const linkedItem = wishlistItems.find((item) => item.id === linkedWishlistItemId) ?? null;
  const canUseItemPrice =
    linkedItem !== null && linkedItem.priceCents !== null && linkedItem.priceCents > 0 && linkedItem.priceCents !== targetAmountCents;

  useBottomSheetDirty(
    title.trim() !== initial.title ||
      targetAmountCents !== initial.targetAmountCents ||
      initialSavedCents !== null ||
      targetDate !== initial.targetDate ||
      icon !== initial.icon ||
      categoryId !== initial.categoryId ||
      description.trim() !== initial.description ||
      linkedWishlistItemId !== initial.linkedWishlistItemId,
  );

  const selectWishlistItem = (itemId: string | null) => {
    setLinkedWishlistItemId(itemId);
    // Only fill the name when it is still empty; the target is offered, never forced.
    const item = wishlistItems.find((candidate) => candidate.id === itemId);
    if (item && !title.trim()) setTitle(`Comprar ${item.name}`);
  };

  const submit = async () => {
    if (savingRef.current) return;
    const normalizedTitle = title.trim();
    const nextErrors: typeof errors = {};
    if (!normalizedTitle) nextErrors.title = 'Dê um nome para a meta.';
    if (targetAmountCents === null || targetAmountCents <= 0) nextErrors.target = 'Informe um valor maior que zero.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0 || targetAmountCents === null) return;

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    try {
      const input = {
        id: goalId,
        title: normalizedTitle,
        description: description.trim() || null,
        targetAmountCents,
        targetDate,
        icon,
        categoryId,
        linkedWishlistItemId,
      };
      if (goal) await updateGoal(input);
      else await createGoal(input, initialSavedCents ?? 0, toDateKey(new Date()));
      notifyDataChanged('goals');
      onSaved(goal ? 'Meta atualizada.' : 'Meta criada. Um pouquinho de cada vez!', goalId);
    } catch (error: unknown) {
      setFormError(describeError(error, 'Não foi possível salvar a meta. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <BottomSheetScrollView>
        <TextField
          autoFocus={!goal && !draft}
          error={errors.title}
          label="Nome da meta"
          maxLength={80}
          onChangeText={(text) => {
            setTitle(text);
            if (errors.title) setErrors((current) => ({ ...current, title: undefined }));
          }}
          placeholder="Ex.: Viagem para Lisboa"
          value={title}
        />

        <View style={formStyles.row}>
          <CurrencyInput
            containerStyle={formStyles.half}
            error={errors.target}
            label="Valor da meta (R$)"
            onChange={(cents) => {
              setTargetAmountCents(cents);
              if (errors.target) setErrors((current) => ({ ...current, target: undefined }));
            }}
            value={targetAmountCents}
          />
          {goal ? (
            <OptionalDateField
              containerStyle={formStyles.half}
              label="Data alvo"
              onChange={setTargetDate}
              value={targetDate}
            />
          ) : (
            <CurrencyInput
              containerStyle={formStyles.half}
              helper="Opcional"
              label="Já guardado (R$)"
              onChange={setInitialSavedCents}
              value={initialSavedCents}
            />
          )}
        </View>

        {goal ? null : (
          <OptionalDateField label="Data alvo (opcional)" onChange={setTargetDate} value={targetDate} />
        )}

        <FormField label="Ícone">
          <ScrollView
            contentContainerStyle={styles.icons}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}>
            {goalIcons.map((emoji) => {
              const selected = icon === emoji;
              return (
                <Pressable
                  accessibilityLabel={`Ícone ${emoji}`}
                  accessibilityRole="radio"
                  accessibilityState={{ checked: selected }}
                  key={emoji}
                  onPress={() => setIcon(selected ? null : emoji)}
                  style={[
                    styles.icon,
                    selected
                      ? { backgroundColor: colors.accentSoft, borderColor: colors.accent }
                      : { backgroundColor: colors.surface, borderColor: colors.border },
                  ]}>
                  <AppText style={styles.emoji}>{emoji}</AppText>
                </Pressable>
              );
            })}
          </ScrollView>
        </FormField>

        <CategorySelector categories={categories} onChange={setCategoryId} onCreate={addCategory} value={categoryId} />

        <View style={formStyles.group}>
          <SelectField
            label="Desejo vinculado"
            noneLabel="Nenhum"
            onChange={selectWishlistItem}
            options={wishlistItems.map((item) => ({
              value: item.id,
              label: item.priceCents === null ? item.name : `${item.name} · ${formatCurrency(item.priceCents)}`,
            }))}
            value={linkedWishlistItemId}
          />
          {canUseItemPrice && linkedItem?.priceCents ? (
            <Pressable
              accessibilityRole="button"
              hitSlop={6}
              onPress={() => {
                setTargetAmountCents(linkedItem.priceCents);
                setErrors((current) => ({ ...current, target: undefined }));
              }}>
              <AppText color="accent" variant="label">
                Usar o preço do produto como meta ({formatCurrency(linkedItem.priceCents)})
              </AppText>
            </Pressable>
          ) : null}
        </View>

        <TextField
          label="Motivação (opcional)"
          maxLength={500}
          multiline
          onChangeText={setDescription}
          placeholder="Por que essa meta importa para você?"
          value={description}
        />

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <PrimaryButton label={goal ? 'Salvar meta' : 'Criar meta'} loading={saving} onPress={() => void submit()} />
      </BottomSheetFooter>
    </>
  );
}

type GoalSheetProps = {
  draft?: GoalDraft | null;
  goal?: Goal | null;
  onClose: () => void;
  onSaved: (message: string, goalId: string) => void;
  visible: boolean;
};

export function GoalSheet({ draft = null, goal = null, onClose, onSaved, visible }: GoalSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title={goal ? 'Editar meta' : 'Nova meta'} visible={visible}>
      <GoalForm draft={draft} goal={goal} onSaved={onSaved} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  emoji: {
    fontSize: 20,
    lineHeight: 26,
  },
  icon: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    height: 44,
    justifyContent: 'center',
    width: 44,
  },
  icons: {
    gap: 7,
  },
});
