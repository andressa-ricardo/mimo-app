import Ionicons from '@expo/vector-icons/Ionicons';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, TextInput, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

type InlineAddInputProps = {
  onCancel: () => void;
  onSubmit: (name: string) => Promise<void>;
  placeholder: string;
};

/** Small text row used to register a custom category or payment method. */
export function InlineAddInput({ onCancel, onSubmit, placeholder }: InlineAddInputProps) {
  const { colors } = useAppTheme();
  const [name, setName] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const submit = async () => {
    if (saving) return;
    if (!name.trim()) {
      setError('Informe um nome.');
      return;
    }
    setSaving(true);
    setError(null);
    try {
      await onSubmit(name);
    } catch (submitError: unknown) {
      setError(submitError instanceof Error ? submitError.message : 'Não foi possível adicionar.');
      setSaving(false);
    }
  };

  return (
    <View style={styles.container}>
      <View style={[styles.row, { backgroundColor: colors.surface, borderColor: error ? colors.error : colors.accent }]}>
        <TextInput
          accessibilityLabel={placeholder}
          autoFocus
          maxLength={40}
          onChangeText={setName}
          onSubmitEditing={() => void submit()}
          placeholder={placeholder}
          placeholderTextColor={colors.textSecondary}
          returnKeyType="done"
          selectionColor={colors.accent}
          style={[styles.input, { color: colors.text }]}
          value={name}
        />
        {saving ? (
          <ActivityIndicator color={colors.accent} size="small" />
        ) : (
          <>
            <Pressable accessibilityLabel="Cancelar" accessibilityRole="button" hitSlop={8} onPress={onCancel}>
              <Ionicons color={colors.textSecondary} name="close" size={19} />
            </Pressable>
            <Pressable
              accessibilityLabel="Adicionar"
              accessibilityRole="button"
              hitSlop={8}
              onPress={() => void submit()}>
              <Ionicons color={colors.accent} name="checkmark" size={21} />
            </Pressable>
          </>
        )}
      </View>
      {error ? (
        <AppText style={{ color: colors.error }} variant="caption">
          {error}
        </AppText>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    gap: 5,
  },
  input: {
    flex: 1,
    fontFamily: 'Inter_400Regular',
    fontSize: 13,
    paddingVertical: 8,
  },
  row: {
    alignItems: 'center',
    borderRadius: 12,
    borderWidth: 1,
    flexDirection: 'row',
    gap: 12,
    minHeight: 40,
    paddingHorizontal: 12,
  },
});
