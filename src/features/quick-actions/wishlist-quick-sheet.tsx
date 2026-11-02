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
import { insertWishlistItem } from '@/database/repositories/wishlist-repository';
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

const URL_PATTERN = /^https?:\/\/[^\s/.]+\.[^\s]+$/i;

function normalizeUrl(text: string): { value: string | null; valid: boolean } {
  const trimmed = text.trim();
  if (!trimmed) return { value: null, valid: true };
  const withScheme = /^[a-z][a-z\d+.-]*:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  return { value: withScheme, valid: URL_PATTERN.test(withScheme) };
}

function WishlistForm({ onSaved }: { onSaved: QuickSheetProps['onSaved'] }) {
  const { colors } = useAppTheme();
  const [itemId] = useState(() => randomUUID());
  const [imageUri, setImageUri] = useState<string | null>(null);
  const [name, setName] = useState('');
  const [priceCents, setPriceCents] = useState<number | null>(null);
  const [categoryId, setCategoryId] = useState<string | null>(null);
  const [priority, setPriority] = useState<Priority>('medium');
  const [productUrl, setProductUrl] = useState('');
  const [notes, setNotes] = useState('');
  const [errors, setErrors] = useState<{ name?: string; url?: string }>({});
  const [formError, setFormError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const savingRef = useRef(false);
  const pickedUriRef = useRef<string | null>(null);
  const { categories, addCategory } = useCategories('wishlist');

  useBottomSheetDirty(
    imageUri !== null ||
      name.trim().length > 0 ||
      priceCents !== null ||
      categoryId !== null ||
      priority !== 'medium' ||
      productUrl.trim().length > 0 ||
      notes.trim().length > 0,
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
    pickedUriRef.current = uri;
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
      if (imageUri) image = await prepareImageForStorage(imageUri);
      await insertWishlistItem(
        {
          id: itemId,
          name: normalizedName,
          priceCents,
          productUrl: url.value,
          categoryId,
          priority,
          notes: notes.trim() || null,
        },
        image,
      );
      notifyDataChanged('wishlist');
      onSaved('Desejo salvo.');
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

export function WishlistQuickSheet({ onClose, onSaved, visible }: QuickSheetProps) {
  return (
    <BottomSheet onRequestClose={onClose} title="Novo desejo" visible={visible}>
      <WishlistForm onSaved={onSaved} />
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
