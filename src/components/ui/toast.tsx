import Ionicons from '@expo/vector-icons/Ionicons';
import { useEffect, useState } from 'react';
import { Animated, StyleSheet } from 'react-native';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

const VISIBLE_MS = 2800;

export type ToastMessage = { id: number; text: string };

type ToastProps = {
  message: ToastMessage | null;
  onHide: () => void;
};

/** Short, non-blocking confirmation pinned near the bottom of the screen. */
export function Toast({ message, onHide }: ToastProps) {
  const { colors } = useAppTheme();
  const [opacity] = useState(() => new Animated.Value(0));

  useEffect(() => {
    if (!message) return;
    opacity.setValue(0);
    Animated.timing(opacity, { toValue: 1, duration: 180, useNativeDriver: true }).start();
    const timer = setTimeout(() => {
      Animated.timing(opacity, { toValue: 0, duration: 220, useNativeDriver: true }).start(({ finished }) => {
        if (finished) onHide();
      });
    }, VISIBLE_MS);
    return () => clearTimeout(timer);
  }, [message, onHide, opacity]);

  if (!message) return null;

  return (
    <Animated.View
      accessibilityLiveRegion="polite"
      accessibilityRole="alert"
      pointerEvents="none"
      style={[styles.toast, { backgroundColor: colors.text, opacity }]}>
      <Ionicons color={colors.background} name="checkmark-circle" size={17} />
      <AppText style={[styles.text, { color: colors.background }]} variant="label">
        {message.text}
      </AppText>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  text: {
    flexShrink: 1,
  },
  toast: {
    alignItems: 'center',
    alignSelf: 'center',
    borderRadius: 16,
    bottom: 16,
    flexDirection: 'row',
    gap: 8,
    left: 16,
    maxWidth: 528,
    paddingHorizontal: 14,
    paddingVertical: 11,
    position: 'absolute',
    right: 16,
  },
});
