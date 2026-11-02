import { router } from 'expo-router';
import { useCallback, useState } from 'react';
import { StyleSheet, View } from 'react-native';

import { PrimaryButton } from '@/components/forms/primary-button';
import { AppText } from '@/components/ui/app-text';
import { GoalCard } from '@/features/goals/components/goal-card';
import { GoalSheet, type GoalDraft } from '@/features/goals/components/goal-sheet';
import { useGoalsForWishlistItem } from '@/features/goals/use-goals';
import type { WishlistItem } from '@/types/wishlist';

/**
 * Goal progress for a wishlist product: shows the linked goal(s), or offers to
 * create one pre-filled with the product's name and price.
 */
export function WishlistGoalSection({
  item,
  onFeedback,
}: {
  item: WishlistItem;
  onFeedback: (message: string) => void;
}) {
  const state = useGoalsForWishlistItem(item.id);
  const [draft, setDraft] = useState<GoalDraft | null>(null);

  const closeSheet = useCallback(() => setDraft(null), []);
  const handleSaved = useCallback(
    (message: string) => {
      setDraft(null);
      onFeedback(message);
    },
    [onFeedback],
  );

  const goals = state.data ?? [];
  if (state.status !== 'ready') return null;
  // Nothing to save for once it is bought, unless a goal already exists.
  if (goals.length === 0 && item.purchasedAt !== null) return null;

  return (
    <View style={styles.section}>
      <AppText accessibilityRole="header" variant="section">
        Meta
      </AppText>
      {goals.length > 0 ? (
        goals.map((goal) => (
          <GoalCard
            goal={goal}
            key={goal.id}
            onPress={() => router.push({ pathname: '/goals/[id]', params: { id: goal.id } }, { withAnchor: true })}
          />
        ))
      ) : (
        <>
          <AppText color="secondary" variant="caption">
            Crie uma meta para este desejo e acompanhe quanto já conseguiu guardar.
          </AppText>
          <PrimaryButton
            icon="flag-outline"
            label="Criar meta para este desejo"
            onPress={() =>
              setDraft({
                title: `Comprar ${item.name}`,
                targetAmountCents: item.priceCents,
                icon: '🛍️',
                linkedWishlistItemId: item.id,
              })
            }
            variant="outlined"
          />
        </>
      )}

      <GoalSheet draft={draft} onClose={closeSheet} onSaved={handleSaved} visible={draft !== null} />
    </View>
  );
}

const styles = StyleSheet.create({
  section: {
    gap: 10,
  },
});
