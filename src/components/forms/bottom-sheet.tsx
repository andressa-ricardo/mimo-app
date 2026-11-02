import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import {
  Alert,
  Animated,
  Easing,
  Keyboard,
  Modal,
  PanResponder,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type ScrollViewProps,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

const DISMISS_DISTANCE = 110;
const DISMISS_VELOCITY = 1.1;

type BottomSheetContextValue = { setDirty: (dirty: boolean) => void };

const BottomSheetContext = createContext<BottomSheetContextValue | null>(null);

/** Forms call this so the sheet asks before discarding unsaved input. */
export function useBottomSheetDirty(dirty: boolean): void {
  const context = useContext(BottomSheetContext);
  useEffect(() => {
    context?.setDirty(dirty);
    return () => context?.setDirty(false);
  }, [context, dirty]);
}

type BottomSheetProps = {
  children: ReactNode;
  onRequestClose: () => void;
  title: string;
  visible: boolean;
};

/**
 * Modal bottom sheet built on React Native primitives: drag handle with swipe
 * to dismiss, tap-outside, Android back, keyboard and safe-area padding.
 * Children are mounted only while the sheet is shown, so forms reset on reopen.
 */
export function BottomSheet({ children, onRequestClose, title, visible }: BottomSheetProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight } = useWindowDimensions();
  const [rendered, setRendered] = useState(visible);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const [translateY] = useState(() => new Animated.Value(windowHeight));
  const [dirty, setDirty] = useState(false);
  const closingRef = useRef(false);

  if (visible && !rendered) setRendered(true);

  const springBack = useCallback(() => {
    Animated.spring(translateY, {
      toValue: 0,
      damping: 22,
      stiffness: 220,
      useNativeDriver: true,
    }).start();
  }, [translateY]);

  const requestClose = useCallback(() => {
    if (!dirty) {
      onRequestClose();
      return;
    }

    Keyboard.dismiss();
    Alert.alert('Descartar alterações?', 'As informações preenchidas serão perdidas.', [
      { text: 'Continuar editando', style: 'cancel', onPress: springBack },
      { text: 'Descartar', style: 'destructive', onPress: onRequestClose },
    ], { cancelable: true, onDismiss: springBack });
  }, [dirty, onRequestClose, springBack]);

  useEffect(() => {
    if (visible) {
      // Reopened while the exit animation was still running.
      if (closingRef.current) {
        closingRef.current = false;
        springBack();
      }
      return;
    }
    if (!rendered) return;
    closingRef.current = true;
    Keyboard.dismiss();
    Animated.timing(translateY, {
      toValue: windowHeight,
      duration: 220,
      easing: Easing.in(Easing.cubic),
      useNativeDriver: true,
    }).start(({ finished }) => {
      if (!finished) return;
      closingRef.current = false;
      setRendered(false);
    });
  }, [rendered, springBack, translateY, visible, windowHeight]);

  useEffect(() => {
    if (!rendered) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const showSubscription = Keyboard.addListener(showEvent, (event) =>
      setKeyboardHeight(event.endCoordinates.height),
    );
    const hideSubscription = Keyboard.addListener(hideEvent, () => setKeyboardHeight(0));
    return () => {
      showSubscription.remove();
      hideSubscription.remove();
    };
  }, [rendered]);

  const panResponder = useMemo(
    () =>
      PanResponder.create({
        onStartShouldSetPanResponder: () => true,
        onMoveShouldSetPanResponder: (_, gesture) =>
          gesture.dy > 4 && Math.abs(gesture.dy) > Math.abs(gesture.dx),
        onPanResponderMove: (_, gesture) => translateY.setValue(Math.max(0, gesture.dy)),
        onPanResponderRelease: (_, gesture) => {
          if (gesture.dy > DISMISS_DISTANCE || gesture.vy > DISMISS_VELOCITY) {
            requestClose();
          } else {
            springBack();
          }
        },
        onPanResponderTerminate: springBack,
      }),
    [requestClose, springBack, translateY],
  );

  const context = useMemo<BottomSheetContextValue>(() => ({ setDirty }), []);

  const handleShow = () => {
    translateY.setValue(windowHeight);
    Animated.timing(translateY, {
      toValue: 0,
      duration: 320,
      easing: Easing.out(Easing.cubic),
      useNativeDriver: true,
    }).start();
  };

  const backdropOpacity = translateY.interpolate({
    inputRange: [0, windowHeight],
    outputRange: [1, 0],
    extrapolate: 'clamp',
  });

  return (
    <Modal
      animationType="none"
      navigationBarTranslucent
      onRequestClose={requestClose}
      onShow={handleShow}
      statusBarTranslucent
      transparent
      visible={rendered}>
      <View style={styles.root}>
        <Animated.View
          style={[StyleSheet.absoluteFill, { backgroundColor: colors.overlay, opacity: backdropOpacity }]}>
          <Pressable
            accessibilityLabel="Fechar"
            accessibilityRole="button"
            onPress={requestClose}
            style={StyleSheet.absoluteFill}
          />
        </Animated.View>

        <Animated.View
          accessibilityViewIsModal
          style={[
            styles.sheet,
            {
              backgroundColor: colors.background,
              maxHeight: windowHeight - insets.top - 12,
              paddingBottom: Math.max(keyboardHeight, insets.bottom) + 12,
              transform: [{ translateY }],
            },
          ]}>
          <View {...panResponder.panHandlers} style={styles.header}>
            <View style={[styles.handle, { backgroundColor: colors.border }]} />
            <AppText accessibilityRole="header" style={styles.title} variant="section">
              {title}
            </AppText>
          </View>
          <BottomSheetContext.Provider value={context}>{rendered ? children : null}</BottomSheetContext.Provider>
        </Animated.View>
      </View>
    </Modal>
  );
}

export function BottomSheetScrollView({ contentContainerStyle, style, ...props }: ScrollViewProps) {
  return (
    <ScrollView
      contentContainerStyle={[styles.scrollContent, contentContainerStyle]}
      keyboardDismissMode="none"
      keyboardShouldPersistTaps="handled"
      showsVerticalScrollIndicator={false}
      style={[styles.scroll, style]}
      {...props}
    />
  );
}

export function BottomSheetFooter({ children }: { children: ReactNode }) {
  return <View style={styles.footer}>{children}</View>;
}

const styles = StyleSheet.create({
  footer: {
    paddingHorizontal: 18,
    paddingTop: 10,
  },
  handle: {
    alignSelf: 'center',
    borderRadius: 3,
    height: 5,
    marginBottom: 14,
    width: 40,
  },
  header: {
    paddingHorizontal: 18,
    paddingBottom: 10,
    paddingTop: 10,
  },
  root: {
    flex: 1,
    justifyContent: 'flex-end',
  },
  scroll: {
    flexGrow: 0,
    flexShrink: 1,
  },
  scrollContent: {
    alignSelf: 'center',
    gap: 14,
    maxWidth: 560,
    paddingBottom: 4,
    paddingHorizontal: 18,
    width: '100%',
  },
  sheet: {
    alignSelf: 'center',
    borderTopLeftRadius: 26,
    borderTopRightRadius: 26,
    maxWidth: 640,
    overflow: 'hidden',
    width: '100%',
  },
  title: {
    fontSize: 17,
  },
});
