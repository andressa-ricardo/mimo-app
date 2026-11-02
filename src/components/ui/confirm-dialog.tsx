import { ActivityIndicator, Modal, Pressable, StyleSheet, View } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

type ConfirmDialogProps = {
  cancelLabel: string;
  confirmLabel: string;
  loading?: boolean;
  message: string;
  onCancel: () => void;
  onConfirm: () => void;
  title: string;
  tone?: 'accent' | 'destructive';
  visible: boolean;
};

/** Themed replacement for Alert.alert, matching the Soft Minimalism dialogs. */
export function ConfirmDialog({
  cancelLabel,
  confirmLabel,
  loading = false,
  message,
  onCancel,
  onConfirm,
  title,
  tone = 'accent',
  visible,
}: ConfirmDialogProps) {
  const { colors } = useAppTheme();
  const destructive = tone === 'destructive';
  const confirmColor = destructive ? colors.error : colors.accent;
  const confirmTextColor = destructive ? '#FFFFFF' : colors.onAccent;

  return (
    <Modal
      animationType="fade"
      navigationBarTranslucent
      onRequestClose={loading ? undefined : onCancel}
      statusBarTranslucent
      transparent
      visible={visible}>
      <View style={[styles.backdrop, { backgroundColor: colors.overlay }]}>
        <Pressable
          accessibilityLabel={cancelLabel}
          disabled={loading}
          onPress={onCancel}
          style={StyleSheet.absoluteFill}
        />
        <View accessibilityViewIsModal style={[styles.card, { backgroundColor: colors.background }]}>
          <AppText accessibilityRole="header" style={styles.title} variant="section">
            {title}
          </AppText>
          <AppText color="secondary">{message}</AppText>
          <View style={styles.actions}>
            <Pressable
              accessibilityRole="button"
              disabled={loading}
              onPress={onCancel}
              style={({ pressed }) => [
                styles.button,
                destructive
                  ? { backgroundColor: colors.accentSoft }
                  : { backgroundColor: colors.surface, borderColor: colors.border, borderWidth: 1 },
                pressed && styles.pressed,
              ]}>
              <AppText variant="label">{cancelLabel}</AppText>
            </Pressable>
            <Pressable
              accessibilityRole="button"
              accessibilityState={{ busy: loading }}
              disabled={loading}
              onPress={onConfirm}
              style={({ pressed }) => [styles.button, { backgroundColor: confirmColor }, pressed && styles.pressed]}>
              {loading ? (
                <ActivityIndicator color={confirmTextColor} size="small" />
              ) : (
                <AppText style={{ color: confirmTextColor }} variant="label">
                  {confirmLabel}
                </AppText>
              )}
            </Pressable>
          </View>
        </View>
      </View>
    </Modal>
  );
}

const styles = StyleSheet.create({
  actions: {
    flexDirection: 'row',
    gap: 10,
    justifyContent: 'flex-end',
    marginTop: 18,
  },
  backdrop: {
    alignItems: 'center',
    flex: 1,
    justifyContent: 'center',
    padding: 24,
  },
  button: {
    alignItems: 'center',
    borderRadius: 19,
    justifyContent: 'center',
    minHeight: 38,
    minWidth: 96,
    paddingHorizontal: 16,
  },
  card: {
    borderRadius: 22,
    maxWidth: 360,
    padding: 22,
    width: '100%',
  },
  pressed: {
    opacity: 0.75,
  },
  title: {
    fontSize: 17,
    marginBottom: 8,
  },
});
