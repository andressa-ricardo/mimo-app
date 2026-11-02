import Ionicons from '@expo/vector-icons/Ionicons';
import { randomUUID } from 'expo-crypto';
import { Image } from 'expo-image';
import { launchImageLibraryAsync } from 'expo-image-picker';
import { useEffect, useRef, useState } from 'react';
import { Pressable, StyleSheet, View } from 'react-native';

import {
  BottomSheet,
  BottomSheetFooter,
  BottomSheetScrollView,
  useBottomSheetDirty,
} from '@/components/forms/bottom-sheet';
import { CurrencyInput } from '@/components/forms/currency-input';
import { PrimaryButton } from '@/components/forms/primary-button';
import { SegmentedControl } from '@/components/forms/segmented-control';
import { SelectField } from '@/components/forms/select-field';
import { FormField, TextField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { insertWishlistItem, updateWishlistItem } from '@/database/repositories/wishlist-repository';
import { FormError, formStyles } from '@/features/quick-actions/form-parts';
import {
  describeError,
  priorityOptions,
  useCategories,
  type QuickSheetProps,
} from '@/features/quick-actions/use-form-options';
import { notifyDataChanged } from '@/services/events/data-events';
import {
  discardPreparedImage,
  discardTemporaryImage,
  prepareImageForStorage,
  type PreparedImage,
} from '@/services/images/image-storage';
import { useAppTheme } from '@/theme/theme-provider';
import type { Priority } from '@/types/tasks';
import type { WishlistImageChange, WishlistItem } from '@/types/wishlist';
import { normalizeUrl } from '@/utils/url';

type WishlistFormProps = {
  item: WishlistItem | null;
  onSaved: QuickSheetProps['onSaved'];
};

function WishlistForm({ item, onSaved }: WishlistFormProps) {
  const { colors } = useAppTheme();
  const [itemId] = useState(() => item?.id ?? randomUUID());
  const [initialImageUri] = useState(() => item?.imageUri ?? null);
  const [imageUri, setImageUri] = useState<string | null>(initialImageUri);
  const [name, setName] = useState(item?.name ?? '');
  const [priceCents, setPriceCents] = useState<number | null>(item?.priceCents ?? null);
  const [categoryId, setCategoryId] = useState<string | null>(item?.categoryId ?? null);
  const [priority, setPriority] = useState<Priority>(item?.priority ?? 'medium');
  const [productUrl, setProductUrl] = useState(item?.productUrl ?? '');
  const [notes, setNotes] = useState(item?.notes ?? '');
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pickedUriRef = useRef<string | null>(null);
  const { categories, addCategory } = useCategories('wishlist');

  useBottomSheetDirty(
    imageUri !== initialImageUri ||
      name.trim() !== (item?.name ?? '') ||
      priceCents !== (item?.priceCents ?? null) ||
      categoryId !== (item?.categoryId ?? null) ||
      priority !== (item?.priority ?? 'medium') ||
      productUrl.trim() !== (item?.productUrl ?? '') ||
      notes.trim() !== (item?.notes ?? ''),
  );

  // The picker's cache copy is temporary whether the item is saved or discarded.
  useEffect(
    () => () => {
      if (pickedUriRef.current) discardTemporaryImage(pickedUriRef.current);
    },
    [],
  );

  const replaceImage = (uri: string | null) => {
    if (pickedUriRef.current && pickedUriRef.current !== uri) discardTemporaryImage(pickedUriRef.current);
    pickedUriRef.current = uri === initialImageUri ? null : uri;
    setImageUri(uri);
  };

  const pickImage = async () => {
    try {
      const result = await launchImageLibraryAsync({ mediaTypes: ['images'], quality: 1 });
      if (!result.canceled && result.assets[0]) replaceImage(result.assets[0].uri);
    } catch (error: unknown) {
      setFormError(describeError(error, 'Não foi possível abrir a galeria.'));
    }
  };

  const submit = async () => {
    if (savingRef.current) return;
    const normalizedName = name.trim();
    const url = normalizeUrl(productUrl);
    const nextErrors: typeof errors = {};
    if (!normalizedName) nextErrors.name = 'Informe o nome do produto.';
    if (!url.valid) nextErrors.url = 'Informe um link válido.';
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length > 0) return;

    savingRef.current = true;
    setSaving(true);
    setFormError(null);
    let image: PreparedImage | null = null;
    try {
      const imageChanged = imageUri !== initialImageUri;
      if (imageUri && imageChanged) image = await prepareImageForStorage(imageUri);
      const input = {
        id: itemId,
        name: normalizedName,
        priceCents,
        productUrl: url.value,
        categoryId,
        priority,
        notes: notes.trim() || null,
      };

      if (item) {
        const imageChange: WishlistImageChange = !imageChanged
          ? { kind: 'keep' }
          : image
            ? { kind: 'replace', image }
            : { kind: 'remove' };
        await updateWishlistItem(input, imageChange);
      } else {
        await insertWishlistItem(input, image);
      }
      notifyDataChanged('wishlist');
      onSaved(item ? 'Desejo atualizado.' : 'Desejo salvo.');
    } catch (error: unknown) {
      if (image) discardPreparedImage(image);
      setFormError(describeError(error, 'Não foi possível salvar o desejo. Tente novamente.'));
      savingRef.current = false;
      setSaving(false);
    }
  };

  return (
    <>
      <BottomSheetScrollView>
        <FormField helper="Escolha uma imagem da galeria." label="Imagem">
          <View style={styles.imageRow}>
            {imageUri ? (
              <View>
                <Image contentFit="cover" source={imageUri} style={styles.imageTile} />
                <Pressable
                  accessibilityLabel="Remover imagem"
                  accessibilityRole="button"
                  hitSlop={8}
                  onPress={() => replaceImage(null)}
                  style={[styles.removeImage, { backgroundColor: colors.surface, borderColor: colors.border }]}>
                  <Ionicons color={colors.text} name="close" size={14} />
                </Pressable>
              </View>
            ) : null}
            <Pressable
              accessibilityLabel={imageUri ? 'Trocar imagem' : 'Escolher imagem da galeria'}
              accessibilityRole="button"
              onPress={() => void pickImage()}
              style={({ pressed }) => [
                styles.imageTile,
                styles.pickTile,
                { backgroundColor: colors.surface, borderColor: colors.border },
                pressed && styles.pressed,
              ]}>
              <Ionicons color={colors.textSecondary} name={imageUri ? 'swap-horizontal' : 'image-outline'} size={22} />
              {imageUri ? (
                <AppText color="secondary" variant="caption">
                  Trocar
                </AppText>
              ) : null}
            </Pressable>
          </View>
        </FormField>

        <TextField
          error={errors.name}
          label="Nome"
          maxLength={120}
          onChangeText={(text) => {
            setName(text);
            if (errors.name) setErrors((current) => ({ ...current, name: undefined }));
          }}
          placeholder="Ex.: Bolsa de couro"
          value={name}
        />

        <View style={formStyles.row}>
          <CurrencyInput
            containerStyle={formStyles.half}
            label="Preço (R$)"
            onChange={setPriceCents}
            value={priceCents}
          />
          <SelectField
            addLabel="Nova categoria"
            addPlaceholder="Nome da categoria"
            containerStyle={formStyles.half}
            label="Categoria"
            noneLabel="Sem categoria"
            onAdd={async (categoryName) => (await addCategory(categoryName)).id}
            onChange={setCategoryId}
            options={categories.map((category) => ({ value: category.id, label: category.name }))}
            value={categoryId}
          />
        </View>

        <View style={formStyles.group}>
          <AppText color="secondary" variant="label">
            Prioridade
          </AppText>
          <SegmentedControl
            accessibilityLabel="Prioridade"
            onChange={setPriority}
            options={priorityOptions}
            value={priority}
          />
        </View>

        <TextField
          autoCapitalize="none"
          autoCorrect={false}
          error={errors.url}
          inputMode="url"
          keyboardType="url"
          label="Link do produto"
          maxLength={2048}
          onChangeText={(text) => {
            setProductUrl(text);
            if (errors.url) setErrors((current) => ({ ...current, url: undefined }));
          }}
          placeholder="https://"
          value={productUrl}
        />

        <TextField
          label="Observações"
          maxLength={1000}
          multiline
          onChangeText={setNotes}
          value={notes}
        />

        {formError ? <FormError message={formError} /> : null}
      </BottomSheetScrollView>
      <BottomSheetFooter>
        <PrimaryButton label="Salvar" loading={saving} onPress={() => void submit()} />
      </BottomSheetFooter>
    </>
  );
}

type WishlistQuickSheetProps = QuickSheetProps & {
  /** When set, the sheet edits this item instead of creating a new one. */
  item?: WishlistItem | null;
};

export function WishlistQuickSheet({ item = null, onClose, onSaved, visible }: WishlistQuickSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title={item ? 'Editar desejo' : 'Novo desejo'} visible={visible}>
      <WishlistForm item={item} onSaved={onSaved} />
    </BottomSheet>
  );
}

const styles = StyleSheet.create({
  imageRow: {
    flexDirection: 'row',
    gap: 10,
  },
  imageTile: {
    borderRadius: 18,
    height: 76,
    width: 76,
  },
  pickTile: {
    alignItems: 'center',
    borderStyle: 'dashed',
    borderWidth: 1.2,
    gap: 2,
    justifyContent: 'center',
  },
  pressed: {
    opacity: 0.7,
  },
  removeImage: {
    alignItems: 'center',
    borderRadius: 11,
    borderWidth: 1,
    height: 22,
    justifyContent: 'center',
    position: 'absolute',
    right: -6,
    top: -6,
    width: 22,
  },
});
