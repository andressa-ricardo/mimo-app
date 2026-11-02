import Ionicons from '@expo/vector-icons/Ionicons';
import { Image } from 'expo-image';
import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import {
  ActivityIndicator,
  FlatList,
  Pressable,
  ScrollView,
  StyleSheet,
  TextInput,
  View,
  useWindowDimensions,
} from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { MoreModulesMenu } from '@/components/navigation/more-modules-menu';
import { AppText } from '@/components/ui/app-text';
import { FilterChip } from '@/components/ui/filter-chip';
import { SwipeView } from '@/components/ui/swipe-view';
import { Toast, type ToastMessage } from '@/components/ui/toast';
import { WishlistQuickSheet } from '@/features/quick-actions/wishlist-quick-sheet';
import { useWishlistItems } from '@/features/wishlist/use-wishlist';
import { searchable } from '@/features/wishlist/wishlist-meta';
import { priorityRank } from '@/theme/priority';
import { categoryColor } from '@/theme/category-colors';
import { useAppTheme } from '@/theme/theme-provider';
import type { WishlistItem } from '@/types/wishlist';
import { formatCurrency } from '@/utils/format';

type StatusFilter = 'desired' | 'purchased' | 'all';

const statusOrder: StatusFilter[] = ['desired', 'purchased', 'all'];

const CONTENT_MAX_WIDTH = 560;
const GRID_PADDING = 16;
const GRID_GAP = 12;

const statusFilters: { value: StatusFilter; label: string }[] = [
  { value: 'desired', label: 'Desejados' },
  { value: 'purchased', label: 'Comprados' },
  { value: 'all', label: 'Todos' },
];

function WishlistCard({ item, width }: { item: WishlistItem; width: number }) {
  const { colors, isDark } = useAppTheme();

  return (
    <Pressable
      accessibilityHint="Abre os detalhes do produto"
      accessibilityLabel={`${item.name}${item.priceCents === null ? '' : `, ${formatCurrency(item.priceCents)}`}`}
      accessibilityRole="button"
      onPress={() => router.push({ pathname: '/wishlist/[id]', params: { id: item.id } })}
      style={({ pressed }) => [{ width }, pressed && styles.pressed]}>
      <View>
        {item.imageUri ? (
          <Image
            contentFit="cover"
            source={item.imageUri}
            style={[styles.cardImage, { backgroundColor: colors.muted, height: width }]}
            transition={150}
          />
        ) : (
          <View style={[styles.cardImage, styles.imageFallback, { backgroundColor: colors.accentSoft, height: width }]}>
            <Ionicons color={colors.accent} name="heart-outline" size={28} />
          </View>
        )}
        {item.purchasedAt !== null ? (
          <View style={[styles.badge, { backgroundColor: colors.surface }]}>
            <Ionicons color={colors.success} name="checkmark-circle" size={13} />
            <AppText variant="caption">Comprado</AppText>
          </View>
        ) : null}
      </View>
      <AppText numberOfLines={1} style={styles.cardName} variant="label">
        {item.name}
      </AppText>
      <View style={styles.cardFooter}>
        <AppText color="accent" numberOfLines={1} style={styles.cardPrice} variant="label">
          {item.priceCents === null ? 'Sem preço' : formatCurrency(item.priceCents)}
        </AppText>
        {item.categoryId && item.categoryName ? (
          <View style={styles.categoryTag}>
            <View style={[styles.categoryDot, { backgroundColor: categoryColor(item.categoryId, isDark) }]} />
            <AppText color="secondary" numberOfLines={1} style={styles.categoryText} variant="caption">
              {item.categoryName}
            </AppText>
          </View>
        ) : null}
      </View>
    </Pressable>
  );
}

function EmptyList({ filtered, onAdd }: { filtered: boolean; onAdd: () => void }) {
  const { colors } = useAppTheme();
  return (
    <View style={styles.empty}>
      <View style={[styles.emptyIcon, { backgroundColor: colors.accentSoft }]}>
        <Ionicons color={colors.accent} name={filtered ? 'search-outline' : 'heart-outline'} size={24} />
      </View>
      <AppText style={styles.emptyTitle} variant="section">
        {filtered ? 'Nenhum produto encontrado' : 'Sua wishlist está vazia'}
      </AppText>
      <AppText color="secondary" style={styles.emptyMessage}>
        {filtered ? 'Tente outro filtro ou termo de busca.' : 'Guarde aqui o que você quer comprar um dia.'}
      </AppText>
      {filtered ? null : (
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onAdd} style={styles.emptyAction}>
          <AppText color="accent" variant="label">
            + Adicionar desejo
          </AppText>
        </Pressable>
      )}
    </View>
  );
}

export function WishlistScreen() {
  const { colors } = useAppTheme();
  const { width: windowWidth } = useWindowDimensions();
  const state = useWishlistItems();
  const [statusFilter, setStatusFilter] = useState<StatusFilter>('desired');
  const [recentFirst, setRecentFirst] = useState(false);
  const [categoryFilter, setCategoryFilter] = useState<string | null>(null);
  const [query, setQuery] = useState('');
  const [addOpen, setAddOpen] = useState(false);
  const [toast, setToast] = useState<ToastMessage | null>(null);

  const closeAdd = useCallback(() => setAddOpen(false), []);
  const showNextFilter = useCallback(
    () => setStatusFilter((current) => statusOrder[Math.min(statusOrder.indexOf(current) + 1, statusOrder.length - 1)]),
    [],
  );
  const showPreviousFilter = useCallback(
    () => setStatusFilter((current) => statusOrder[Math.max(statusOrder.indexOf(current) - 1, 0)]),
    [],
  );
  const hideToast = useCallback(() => setToast(null), []);
  const handleSaved = useCallback((text: string) => {
    setAddOpen(false);
    setToast({ id: Date.now(), text });
  }, []);

  const items = state.data ?? [];
  const desiredTotal = items.reduce(
    (total, item) => (item.purchasedAt === null && item.priceCents !== null ? total + item.priceCents : total),
    0,
  );
  const desiredCount = items.filter((item) => item.purchasedAt === null).length;

  const categories = new Map<string, string>();
  for (const item of items) {
    if (item.categoryId && item.categoryName) categories.set(item.categoryId, item.categoryName);
  }
  const activeCategory = categoryFilter !== null && categories.has(categoryFilter) ? categoryFilter : null;

  const normalizedQuery = searchable(query.trim());
  const visibleItems = items
    .filter((item) =>
      statusFilter === 'all' ? true : statusFilter === 'purchased' ? item.purchasedAt !== null : item.purchasedAt === null,
    )
    .filter((item) => activeCategory === null || item.categoryId === activeCategory)
    .filter((item) => !normalizedQuery || searchable(item.name).includes(normalizedQuery))
    .sort((a, b) =>
      recentFirst
        ? b.createdAt - a.createdAt
        : priorityRank[a.priority] - priorityRank[b.priority] || b.createdAt - a.createdAt,
    );

  const contentWidth = Math.min(windowWidth, CONTENT_MAX_WIDTH);
  const cardWidth = Math.floor((contentWidth - GRID_PADDING * 2 - GRID_GAP) / 2);
  const isFiltered = items.length > 0;

  return (
    <SafeAreaView edges={['top']} style={[styles.screen, { backgroundColor: colors.background }]}>
      <View style={styles.container}>
        <View style={styles.header}>
          <View style={styles.headerCopy}>
            <AppText variant="title">Wishlist</AppText>
            <AppText color="secondary" variant="caption">
              {desiredCount === 0 ? 'Nenhum desejo ainda' : `${formatCurrency(desiredTotal)} em desejos`}
            </AppText>
          </View>
          <Pressable
            accessibilityLabel="Novo desejo"
            accessibilityRole="button"
            hitSlop={8}
            onPress={() => setAddOpen(true)}
            style={({ pressed }) => [styles.headerButton, pressed && styles.pressed]}>
            <Ionicons color={colors.text} name="add" size={26} />
          </Pressable>
          <MoreModulesMenu />
        </View>

        <View style={[styles.search, { backgroundColor: colors.surface, borderColor: colors.border }]}>
          <Ionicons color={colors.textSecondary} name="search-outline" size={17} />
          <TextInput
            accessibilityLabel="Buscar produtos"
            autoCorrect={false}
            onChangeText={setQuery}
            placeholder="Buscar produtos"
            placeholderTextColor={colors.textSecondary}
            returnKeyType="search"
            selectionColor={colors.accent}
            style={[styles.searchInput, { color: colors.text }]}
            value={query}
          />
          {query ? (
            <Pressable accessibilityLabel="Limpar busca" hitSlop={8} onPress={() => setQuery('')}>
              <Ionicons color={colors.textSecondary} name="close-circle" size={17} />
            </Pressable>
          ) : null}
        </View>

        <ScrollView
          contentContainerStyle={styles.chips}
          horizontal
          keyboardShouldPersistTaps="handled"
          showsHorizontalScrollIndicator={false}
          style={styles.chipRow}>
          {statusFilters.map((filter) => (
            <FilterChip
              key={filter.value}
              label={filter.label}
              onPress={() => setStatusFilter(filter.value)}
              selected={statusFilter === filter.value}
            />
          ))}
          <FilterChip label="Mais recentes" onPress={() => setRecentFirst((current) => !current)} selected={recentFirst} />
        </ScrollView>

        {categories.size > 0 ? (
          <ScrollView
            contentContainerStyle={styles.chips}
            horizontal
            keyboardShouldPersistTaps="handled"
            showsHorizontalScrollIndicator={false}
            style={styles.chipRow}>
            <FilterChip label="Todas" onPress={() => setCategoryFilter(null)} selected={activeCategory === null} />
            {[...categories].map(([id, name]) => (
              <FilterChip
                key={id}
                label={name}
                onPress={() => setCategoryFilter(activeCategory === id ? null : id)}
                selected={activeCategory === id}
              />
            ))}
          </ScrollView>
        ) : null}

        <SwipeView onSwipeLeft={showNextFilter} onSwipeRight={showPreviousFilter} style={styles.swipeArea}>
        {state.status === 'loading' ? (
          <ActivityIndicator color={colors.accent} style={styles.loading} />
        ) : state.status === 'error' ? (
          <AppText color="secondary" style={styles.errorText}>
            Não foi possível carregar sua wishlist.
          </AppText>
        ) : (
          <FlatList
            columnWrapperStyle={styles.gridRow}
            contentContainerStyle={styles.grid}
            data={visibleItems}
            keyExtractor={(item) => item.id}
            keyboardDismissMode="on-drag"
            ListEmptyComponent={<EmptyList filtered={isFiltered} onAdd={() => setAddOpen(true)} />}
            numColumns={2}
            renderItem={({ item }) => <WishlistCard item={item} width={cardWidth} />}
            showsVerticalScrollIndicator={false}
          />
        )}
        </SwipeView>
      </View>

      <Toast message={toast} onHide={hideToast} />
      <WishlistQuickSheet onClose={closeAdd} onSaved={handleSaved} visible={addOpen} />
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  badge: {
    alignItems: 'center',
    borderRadius: 10,
    flexDirection: 'row',
    gap: 4,
    left: 8,
    paddingHorizontal: 7,
    paddingVertical: 3,
    position: 'absolute',
    top: 8,
  },
  cardFooter: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
    justifyContent: 'space-between',
    marginTop: 2,
  },
  cardImage: {
    borderRadius: 18,
    width: '100%',
  },
  cardName: {
    fontSize: 13,
    marginTop: 8,
  },
  cardPrice: {
    flexShrink: 0,
    fontFamily: 'Inter_600SemiBold',
    fontSize: 13,
  },
  categoryDot: {
    borderRadius: 3.5,
    height: 7,
    width: 7,
  },
  categoryTag: {
    alignItems: 'center',
    flexDirection: 'row',
    flexShrink: 1,
    gap: 4,
  },
  categoryText: {
    flexShrink: 1,
    fontSize: 10,
  },
  chipRow: {
    flexGrow: 0,
    marginTop: 10,
  },
  chips: {
    gap: 7,
    paddingHorizontal: GRID_PADDING,
  },
  container: {
    alignSelf: 'center',
    flex: 1,
    maxWidth: CONTENT_MAX_WIDTH,
    width: '100%',
  },
  empty: {
    alignItems: 'center',
    paddingHorizontal: 24,
    paddingTop: 48,
  },
  emptyAction: {
    marginTop: 14,
  },
  emptyIcon: {
    alignItems: 'center',
    borderRadius: 24,
    height: 48,
    justifyContent: 'center',
    width: 48,
  },
  emptyMessage: {
    marginTop: 6,
    textAlign: 'center',
  },
  emptyTitle: {
    marginTop: 14,
    textAlign: 'center',
  },
  errorText: {
    marginTop: 40,
    textAlign: 'center',
  },
  grid: {
    gap: 18,
    paddingBottom: 32,
    paddingHorizontal: GRID_PADDING,
    paddingTop: 16,
  },
  gridRow: {
    gap: GRID_GAP,
  },
  header: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 4,
    paddingHorizontal: GRID_PADDING,
    paddingTop: 8,
  },
  headerButton: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
  headerCopy: {
    flex: 1,
  },
  imageFallback: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  loading: {
    marginTop: 40,
  },
  pressed: {
    opacity: 0.7,
  },
  screen: {
    flex: 1,
  },
  swipeArea: {
    flex: 1,
  },
  search: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 9,
    marginHorizontal: GRID_PADDING,
    marginTop: 14,
    minHeight: 46,
    paddingHorizontal: 14,
  },
  searchInput: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    paddingVertical: 10,
  },
});
