import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet } from 'react-native';

import { InlineAddInput } from '@/components/forms/inline-add-input';
import { FormField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';
import type { Category } from '@/types/categories';

type CategorySelectorProps = {
  categories: Category[];
  label?: string;
  onChange: (categoryId: string | null) => void;
  onCreate: (name: string) => Promise<Category>;
  value: string | null;
};

/** Horizontal chips; tapping the selected chip clears it. The last chip adds a custom category. */
export function CategorySelector({
  categories,
  label = 'Categoria',
  onChange,
  onCreate,
  value,
}: CategorySelectorProps) {
  const { colors } = useAppTheme();
  const [adding, setAdding] = useState(false);

  return (
    <FormField label={label}>
      <ScrollView
        accessibilityLabel={label}
        contentContainerStyle={styles.chips}
        horizontal
        keyboardShouldPersistTaps="handled"
        showsHorizontalScrollIndicator={false}>
        {categories.map((category) => {
          const selected = category.id === value;
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={category.id}
              onPress={() => onChange(selected ? null : category.id)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: colors.accent, borderColor: colors.accent }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <AppText style={selected ? { color: colors.onAccent } : undefined} variant="label">
                {category.name}
              </AppText>
            </Pressable>
          );
        })}
        {adding ? null : (
          <Pressable
            accessibilityLabel="Nova categoria"
            accessibilityRole="button"
            onPress={() => setAdding(true)}
            style={[styles.chip, styles.addChip, { borderColor: colors.border }]}>
            <Ionicons color={colors.accent} name="add" size={15} />
            <AppText color="accent" variant="label">
              Nova
            </AppText>
          </Pressable>
        )}
      </ScrollView>
      {adding ? (
        <InlineAddInput
          onCancel={() => setAdding(false)}
          onSubmit={async (name) => {
            const category = await onCreate(name);
            onChange(category.id);
            setAdding(false);
          }}
          placeholder="Nome da categoria"
        />
      ) : null}
    </FormField>
  );
}

const styles = StyleSheet.create({
  addChip: {
    borderStyle: 'dashed',
    flexDirection: 'row',
    gap: 3,
  },
  chip: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 34,
    paddingHorizontal: 14,
  },
  chips: {
    gap: 7,
    paddingRight: 4,
  },
});
