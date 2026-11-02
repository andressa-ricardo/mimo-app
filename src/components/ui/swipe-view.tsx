import { useMemo, useState, type ReactNode } from 'react';
import { Animated, PanResponder, type StyleProp, type ViewStyle } from 'react-native';

/** Distance (px) or speed (px/ms) that counts as a deliberate swipe. */
const SWIPE_DISTANCE = 60;
const SWIPE_VELOCITY = 0.5;
/** How much the content follows the finger, for feedback. */
const FOLLOW_RATIO = 0.25;

type SwipeViewProps = {
  children: ReactNode;
  /** Finger moves right → left: usually "next". */
  onSwipeLeft: () => void;
  /** Finger moves left → right: usually "previous". */
  onSwipeRight: () => void;
  style?: StyleProp<ViewStyle>;
};

/**
 * Horizontal swipe area. It only claims clearly horizontal gestures, so
 * vertical scrolling and horizontal chip rows inside keep working. The arrow
 * buttons stay as the accessible way to do the same thing.
 */
export function SwipeView({ children, onSwipeLeft, onSwipeRight, style }: SwipeViewProps) {
  const [offset] = useState(() => new Animated.Value(0));

  const responder = useMemo(() => {
    const settle = () =>
      Animated.spring(offset, { toValue: 0, damping: 20, stiffness: 260, useNativeDriver: true }).start();

    return PanResponder.create({
      onMoveShouldSetPanResponder: (_, gesture) =>
        Math.abs(gesture.dx) > 14 && Math.abs(gesture.dx) > Math.abs(gesture.dy) * 1.6,
      onPanResponderMove: (_, gesture) => offset.setValue(gesture.dx * FOLLOW_RATIO),
      onPanResponderRelease: (_, gesture) => {
        if (gesture.dx < -SWIPE_DISTANCE || gesture.vx < -SWIPE_VELOCITY) onSwipeLeft();
        else if (gesture.dx > SWIPE_DISTANCE || gesture.vx > SWIPE_VELOCITY) onSwipeRight();
        settle();
      },
      onPanResponderTerminate: settle,
    });
  }, [offset, onSwipeLeft, onSwipeRight]);

  return (
    <Animated.View {...responder.panHandlers} style={[style, { transform: [{ translateX: offset }] }]}>
      {children}
    </Animated.View>
  );
}
