import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';

import { FormField } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import {
  createAppointmentCategory,
  listAppointmentCategories,
} from '@/database/repositories/appointments-repository';
import { paletteColor, paletteColorKeys, paletteColorLabels, type PaletteColorKey } from '@/theme/category-colors';
import { useAppTheme } from '@/theme/theme-provider';
import type { AppointmentCategory } from '@/types/calendar';

const iconChoices = [
  'person-outline',
  'briefcase-outline',
  'school-outline',
  'medkit-outline',
  'happy-outline',
  'barbell-outline',
  'restaurant-outline',
  'airplane-outline',
  'heart-outline',
  'people-outline',
] as const;

function NewCategoryForm({ onCancel, onCreated }: { onCancel: () => void; onCreated: (category: AppointmentCategory) => void }) {
  const { colors, isDark } = useAppTheme();
  const [name, setName] = useState('');
  const [color, setColor] = useState<PaletteColorKey>('blue');
  const [icon, setIcon] = useState<string>(iconChoices[0]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      setError('Informe um nome.');
      return;
    }
    setSaving(true);
    try {
      onCreated(await createAppointmentCategory(name, color, icon));
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível criar a categoria.');
      setSaving(false);
    }
  };

  return (
    <View style={[styles.newCard, { backgroundColor: colors.surface, borderColor: colors.accent }]}>
      <TextInput
        accessibilityLabel="Nome da categoria"
        autoFocus
        maxLength={40}
        onChangeText={(text) => {
          setName(text);
          setError(null);
        }}
        placeholder="Nome da categoria"
        placeholderTextColor={colors.textSecondary}
        selectionColor={colors.accent}
        style={[styles.input, { color: colors.text, borderColor: colors.border }]}
        value={name}
      />
      <View style={styles.swatches}>
        {paletteColorKeys.map((key) => (
          <Pressable
            accessibilityLabel={`Cor ${paletteColorLabels[key]}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: color === key }}
            hitSlop={4}
            key={key}
            onPress={() => setColor(key)}
            style={[styles.swatchRing, { borderColor: color === key ? colors.text : 'transparent' }]}>
            <View style={[styles.swatch, { backgroundColor: paletteColor(key, isDark) }]} />
          </Pressable>
        ))}
      </View>
      <View style={styles.swatches}>
        {iconChoices.map((choice) => (
          <Pressable
            accessibilityLabel={`Ícone ${choice.replace('-outline', '')}`}
            accessibilityRole="radio"
            accessibilityState={{ checked: icon === choice }}
            key={choice}
            onPress={() => setIcon(choice)}
            style={[styles.iconChoice, icon === choice && { backgroundColor: colors.accentSoft }]}>
            <Ionicons color={icon === choice ? paletteColor(color, isDark) : colors.textSecondary} name={choice} size={17} />
          </Pressable>
        ))}
      </View>
      {error ? (
        <AppText style={{ color: colors.error }} variant="caption">
          {error}
        </AppText>
      ) : null}
      <View style={styles.newActions}>
        <Pressable accessibilityRole="button" hitSlop={8} onPress={onCancel}>
          <AppText color="secondary" variant="label">
            Cancelar
          </AppText>
        </Pressable>
        {saving ? (
          <ActivityIndicator color={colors.accent} />
        ) : (
          <Pressable accessibilityRole="button" hitSlop={8} onPress={() => void submit()}>
            <AppText color="accent" variant="label">
              Criar categoria
            </AppText>
          </Pressable>
        )}
      </View>
    </View>
  );
}

/** Category chips with each category's own color; "+ Nova" creates one with color and icon. */
export function AppointmentCategoryPicker({
  onChange,
  value,
}: {
  onChange: (categoryId: string | null) => void;
  value: string | null;
}) {
  const { colors, isDark } = useAppTheme();
  const [categories, setCategories] = useState<AppointmentCategory[]>([]);
  const [adding, setAdding] = useState(false);

  useEffect(() => {
    let active = true;
    listAppointmentCategories()
      .then((loaded) => {
        if (active) setCategories(loaded);
      })
      .catch((error: unknown) => console.warn('Falha ao carregar categorias.', error));
    return () => {
      active = false;
    };
  }, []);

  return (
    <FormField label="Categoria">
      <ScrollView contentContainerStyle={styles.chips} horizontal keyboardShouldPersistTaps="handled" showsHorizontalScrollIndicator={false}>
        {categories.map((category) => {
          const selected = category.id === value;
          const color = paletteColor(category.color, isDark);
          return (
            <Pressable
              accessibilityRole="radio"
              accessibilityState={{ checked: selected }}
              key={category.id}
              onPress={() => onChange(selected ? null : category.id)}
              style={[
                styles.chip,
                selected
                  ? { backgroundColor: `${color}22`, borderColor: color }
                  : { backgroundColor: colors.surface, borderColor: colors.border },
              ]}>
              <Ionicons color={color} name={category.icon as keyof typeof Ionicons.glyphMap} size={14} />
              <AppText variant="label">{category.name}</AppText>
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
        <NewCategoryForm
          onCancel={() => setAdding(false)}
          onCreated={(category) => {
            setCategories((current) => (current.some((item) => item.id === category.id) ? current : [...current, category]));
            onChange(category.id);
            setAdding(false);
          }}
        />
      ) : null}
    </FormField>
  );
}

const styles = StyleSheet.create({
  addChip: {
    borderStyle: 'dashed',
  },
  chip: {
    alignItems: 'center',
    borderRadius: 18,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 5,
    minHeight: 34,
    paddingHorizontal: 12,
  },
  chips: {
    gap: 7,
    paddingRight: 4,
  },
  iconChoice: {
    alignItems: 'center',
    borderRadius: 10,
    height: 30,
    justifyContent: 'center',
    width: 30,
  },
  input: {
    borderBottomWidth: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 14,
    paddingVertical: 6,
  },
  newActions: {
    alignItems: 'center',
    flexDirection: 'row',
    justifyContent: 'space-between',
  },
  newCard: {
    borderRadius: 14,
    borderWidth: 1,
    gap: 10,
    padding: 12,
  },
  swatch: {
    borderRadius: 9,
    height: 18,
    width: 18,
  },
  swatchRing: {
    alignItems: 'center',
    borderRadius: 13,
    borderWidth: 1.5,
    height: 26,
    justifyContent: 'center',
    width: 26,
  },
  swatches: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: 6,
  },
});
