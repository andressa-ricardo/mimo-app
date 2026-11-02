import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

export type DialogChoice = {
  label: string;
  onPress: () => void;
  tone?: 'default' | 'destructive';
};

type ChoiceDialogProps = {
  cancelLabel?: string;
  choices: DialogChoice[];
  loading?: boolean;
  message?: string;
  onCancel: () => void;
  title: string;
  visible: boolean;
};

/** Themed dialog with several stacked options (e.g. which occurrences to change). */
export function ChoiceDialog({
  cancelLabel = 'Cancelar',
  choices,
  loading = false,
  message,
  onCancel,
  title,
  visible,
}: ChoiceDialogProps) {
  const { colors } = useAppTheme();

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable accessibilityLabel={cancelLabel} disabled={loading} onPress={onCancel} style={StyleSheet.absoluteFill} />
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.background }]}>
          <AppText accessibilityRole="header" style={styles.title} variant="section">
            {title}
          </AppText>
          {message ? <AppText color="secondary">{message}</AppText> : null}
          <View style={styles.choices}>
            {loading ? (
              <ActivityIndicator color={colors.accent} style={styles.loading} />
            ) : (
              choices.map((choice) => (
                <Pressable
                  accessibilityRole="button"
                  key={choice.label}
                  onPress={choice.onPress}
                  style={({ pressed }) => [
                    styles.choice,
                    { backgroundColor: colors.surface, borderColor: colors.border },
                    pressed && styles.pressed,
                  ]}>
                  <AppText
                    style={choice.tone === 'destructive' ? { color: colors.error } : undefined}
                    variant="label">
                    {choice.label}
                  </AppText>
                </Pressable>
              ))
            )}
            <Pressable accessibilityRole="button" disabled={loading} onPress={onCancel} style={styles.cancel}>
              <AppText color="secondary" variant="label">
                {cancelLabel}
              </AppText>
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  cancel: {
    alignItems: 'center',
    minHeight: 40,
    justifyContent: 'center',
  },
  card: {
    borderRadius: 22,
    maxWidth: 360,
    padding: 22,
    width: '100%',
  },
  choice: {
    alignItems: 'center',
    borderRadius: 14,
    borderWidth: 1,
    justifyContent: 'center',
    minHeight: 44,
  },
  choices: {
    gap: 8,
    marginTop: 16,
  },
  loading: {
    marginVertical: 12,
  },
  pressed: {
    opacity: 0.7,
  },
  title: {
    fontSize: 17,
    marginBottom: 6,
  },
});
