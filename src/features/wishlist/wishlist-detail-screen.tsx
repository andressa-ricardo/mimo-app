import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import * as Linking from 'expo-linking';
import { router, useLocalSearchParams } from 'expo-router';
import { useCallback, useRef, useState, type ReactNode } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import { ConfirmDialog } from '@/components/ui/confirm-dialog';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import {
  deleteWishlistItem,
  registerPurchaseExpense,
  setWishlistPurchased,
} from '@/database/repositories/wishlist-repository';
import { WishlistQuickSheet } from '@/features/quick-actions/wishlist-quick-sheet';
import { useWishlistItem } from '@/features/wishlist/use-wishlist';
import { priorityColor, priorityLabels } from '@/features/wishlist/wishlist-meta';
import { notifyDataChanged } from '@/services/events/data-events';
import { useAppTheme } from '@/theme/theme-provider';
import type { WishlistItem } from '@/types/wishlist';
import { formatDateKey, toDateKey } from '@/utils/date';
import { formatCurrency } from '@/utils/format';

type Dialog = 'register-expense' | 'delete' | null;

function formatTimestamp(timestamp: number): string {
  return formatDateKey(toDateKey(new Date(timestamp)));
}

function InfoCell({ children, label }: { children: ReactNode; label: string }) {
  return (
    <View style={styles.infoCell}>
      <AppText color="accent" variant="caption">
        {label}
      </AppText>
      {children}
    </View>
  );
}

function HeaderButton({
  color,
  icon,
  label,
  onPress,
}: {
  color: string;
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  onPress: () => void;
}) {
  return (
    <Pressable
      accessibilityLabel={label}
      accessibilityRole="button"
      hitSlop={8}
      onPress={onPress}
      style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
      <Ionicons color={color} name={icon} size={21} />
    </Pressable>
  );
}

function canRegisterExpense(item: WishlistItem): boolean {
  return item.priceCents !== null && item.priceCents > 0 && item.purchaseTransactionId === null;
}

export function WishlistDetailScreen() {
  const { colors } = useAppTheme();
  const { id } = useLocalSearchParams<{ id: string }>();
  const state = useWishlistItem(id);
  const [dialog, setDialog] = useState<Dialog>(null);
  const [busy, setBusy] = useState(false);
  const busyRef = useRef(false);
  const [editing, setEditing] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const showToast = useCallback((text: string) => setToast({ id: Date.now(), text }), []);
  const hideToast = useCallback(() => setToast(null), []);
  const closeEdit = useCallback(() => setEditing(false), []);
  const handleEdited = useCallback(
    (text: string) => {
      setEditing(false);
      showToast(text);
    },
    [showToast],
  );

  /** Runs one database action at a time, so repeated taps cannot duplicate it. */
  const runExclusive = async (action: () => Promise<void>, errorMessage: string) => {
    if (busyRef.current) return;
    busyRef.current = true;
    setBusy(true);
    try {
      await action();
    } catch (error: unknown) {
      console.error(errorMessage, error);
      setDialog(null);
      showToast(error instanceof Error && error.message.startsWith('Informe') ? error.message : errorMessage);
    } finally {
      busyRef.current = false;
      setBusy(false);
    }
  };

  if (state.status === 'loading') {
    return (
      <SafeAreaView edges={['top']} style={[styles.centered, { backgroundColor: colors.background }]}>
        <ActivityIndicator color={colors.accent} />
      </SafeAreaView>
    );
  }

  const item = state.data;
  if (!item) {
    return (
      <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
        <View style={styles.header}>
          <HeaderButton color={colors.text} icon="chevron-back" label="Voltar" onPress={() => router.back()} />
        </View>
        <View style={styles.centered}>
          <AppText color="secondary">
            {state.status === 'error' ? 'Não foi possível carregar o produto.' : 'Este produto não existe mais.'}
          </AppText>
        </View>
      </SafeAreaView>
    );
  }

  const purchased = item.purchasedAt !== null;

  const markPurchased = () =>
    runExclusive(async () => {
      await setWishlistPurchased(item.id, true);
      notifyDataChanged('wishlist');
      if (canRegisterExpense(item)) setDialog('register-expense');
      else showToast('Marcado como comprado.');
    }, 'Não foi possível atualizar o produto.');

  const markDesired = () =>
    runExclusive(async () => {
      await setWishlistPurchased(item.id, false);
      notifyDataChanged('wishlist');
      showToast('Produto voltou para os desejados.');
    }, 'Não foi possível atualizar o produto.');

  const registerExpense = () =>
    runExclusive(async () => {
      const outcome = await registerPurchaseExpense(item.id);
      setDialog(null);
      notifyDataChanged('wishlist');
      notifyDataChanged('finance');
      showToast(outcome === 'created' ? 'Gasto registrado em Finanças.' : 'Esse gasto já estava registrado.');
    }, 'Não foi possível registrar o gasto.');

  const deleteItem = () =>
    runExclusive(async () => {
      await deleteWishlistItem(item.id);
      setDialog(null);
      router.back();
      notifyDataChanged('wishlist');
    }, 'Não foi possível excluir o produto.');

  const openLink = async () => {
    if (!item.productUrl) return;
    try {
      await Linking.openURL(item.productUrl);
    } catch {
      showToast('Não foi possível abrir o link.');
    }
  };

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.header}>
        <HeaderButton color={colors.text} icon="chevron-back" label="Voltar" onPress={() => router.back()} />
        <View style={styles.headerSpacer} />
        <HeaderButton color={colors.text} icon="pencil-outline" label="Editar produto" onPress={() => setEditing(true)} />
        <HeaderButton color={colors.error} icon="trash-outline" label="Excluir produto" onPress={() => setDialog('delete')} />
      </View>

      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        {item.imageUri ? (
          <Image
            accessibilityLabel={item.name}
            contentFit="cover"
            source={item.imageUri}
            style={[styles.image, { backgroundColor: colors.muted }]}
            transition={150}
          />
        ) : (
          <View style={[styles.image, styles.imageFallback, { backgroundColor: colors.accentSoft }]}>
            <Ionicons color={colors.accent} name="heart-outline" size={44} />
          </View>
        )}

        <View style={styles.titleBlock}>
          {item.categoryName ? (
            <AppText color="secondary" variant="caption">
              {item.categoryName}
            </AppText>
          ) : null}
          <AppText style={styles.name}>{item.name}</AppText>
          <AppText color="accent" style={styles.price}>
            {item.priceCents === null ? 'Preço não informado' : formatCurrency(item.priceCents)}
          </AppText>
        </View>

        <View style={[styles.infoCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <InfoCell label="Prioridade">
            <View style={styles.priorityRow}>
              <View style={[styles.priorityDot, { backgroundColor: priorityColor(item.priority, colors) }]} />
              <AppText>{priorityLabels[item.priority]}</AppText>
            </View>
          </InfoCell>
          <InfoCell label="Status">
            <AppText>{purchased ? 'Comprado' : 'Desejado'}</AppText>
          </InfoCell>
          <InfoCell label="Adicionado em">
            <AppText>{formatTimestamp(item.createdAt)}</AppText>
          </InfoCell>
          {item.purchasedAt !== null ? (
            <InfoCell label="Comprado em">
              <AppText>{formatTimestamp(item.purchasedAt)}</AppText>
            </InfoCell>
          ) : null}
        </View>

        {item.productUrl ? (
          <Pressable
            accessibilityHint="Abre o link no navegador"
            accessibilityRole="link"
            onPress={() => void openLink()}
            style={({ pressed }) => [
              styles.linkRow,
              { backgroundColor: colors.surface, borderColor: colors.border },
              pressed && styles.pressed,
            ]}>
            <Ionicons color={colors.accent} name="link-outline" size={18} />
            <AppText numberOfLines={1} style={styles.linkText}>
              {item.productUrl.replace(/^https?:\/\//i, '')}
            </AppText>
            <Ionicons color={colors.textSecondary} name="open-outline" size={16} />
          </Pressable>
        ) : null}

        {item.notes ? (
          <View style={[styles.notesCard, { backgroundColor: colors.surface, borderColor: colors.border }]}>
            <AppText color="accent" variant="caption">
              Observações
            </AppText>
            <AppText>{item.notes}</AppText>
          </View>
        ) : null}

        {purchased ? (
          <View style={styles.actions}>
            {canRegisterExpense(item) ? (
              <PrimaryButton
                icon="wallet-outline"
                label="Registrar gasto em Finanças"
                loading={busy && dialog === null}
                onPress={() => setDialog('register-expense')}
              />
            ) : null}
            <PrimaryButton
              disabled={busy}
              icon="arrow-undo-outline"
              label="Voltar para desejados"
              onPress={() => void markDesired()}
              variant="outlined"
            />
          </View>
        ) : (
          <PrimaryButton
            icon="bag-handle-outline"
            label="Marcar como comprado"
            loading={busy}
            onPress={() => void markPurchased()}
          />
        )}
      </ScrollView>

      <Toast message={toast} onHide={hideToast} />

      <ConfirmDialog
        cancelLabel="Agora não"
        confirmLabel="Registrar gasto"
        loading={busy}
        message={`Marcamos "${item.name}" como comprado. Quer lançar ${
          item.priceCents === null ? 'o valor' : formatCurrency(item.priceCents)
        } em Finanças?`}
        onCancel={() => setDialog(null)}
        onConfirm={() => void registerExpense()}
        title="Registrar como despesa?"
        visible={dialog === 'register-expense'}
      />
      <ConfirmDialog
        cancelLabel="Cancelar"
        confirmLabel="Excluir"
        loading={busy}
        message="Essa ação não pode ser desfeita."
        onCancel={() => setDialog(null)}
        onConfirm={() => void deleteItem()}
        title="Excluir produto?"
        tone="destructive"
        visible={dialog === 'delete'}
      />

      <WishlistQuickSheet item={item} onClose={closeEdit} onSaved={handleEdited} visible={editing} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  actions: {
    gap: 10,
  },
  centered: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  content: {
    alignSelf: 'center',
    gap: 16,
    maxWidth: 560,
    paddingBottom: 32,
    paddingHorizontal: 16,
    width: '100%',
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: 10,
    paddingVertical: 6,
  },
  headerButton: {
    alignItems: 'center',
    height: 40,
    justifyContent: 'center',
    width: 40,
  },
  headerSpacer: {
    flex: 1,
  },
  image: {
    aspectRatio: 1,
    borderRadius: 24,
    width: '100%',
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  infoCard: {
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    flexWrap: 'wrap',
    paddingHorizontal: 14,
    paddingVertical: 4,
  },
  infoCell: {
    gap: 4,
    paddingVertical: 10,
    width: '50%',
  },
  linkRow: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 10,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  linkText: {
    flex: 1,
  },
  name: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 22,
    letterSpacing: -0.4,
    lineHeight: 28,
  },
  notesCard: {
    borderRadius: 18,
    borderWidth: 1,
    gap: 4,
    padding: 14,
  },
  pressed: {
    opacity: 0.6,
  },
  price: {
    fontFamily: 'Inter_700Bold',
    fontSize: 21,
    lineHeight: 28,
  },
  priorityDot: {
    borderRadius: 4,
    height: 8,
    width: 8,
  },
  priorityRow: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 7,
  },
  screen: {
    flex: 1,
  },
  titleBlock: {
    gap: 2,
  },
});
