import Ionicons from '@expo/vector-icons/Ionicons';
import { Fragment, useEffect, useRef, useState, type ComponentRef } from 'react';
import {
  Keyboard,
  Modal,
  Platform,
  Pressable,
  ScrollView,
  StyleSheet,
  View,
  useWindowDimensions,
  type StyleProp,
  type ViewStyle,
} from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { InlineAddInput } from '@/components/forms/inline-add-input';
import { FormField, inputStyles } from '@/components/forms/text-field';
import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

/** `group` renders a small section header before the first option of each group. */
export type SelectOption = { value: string; label: string; group?: string };

type SelectFieldProps = {
  /** Omit addLabel/onAdd to hide the "+ add" row. */
  addLabel?: string;
  addPlaceholder?: string;
  containerStyle?: StyleProp<ViewStyle>;
  label: string;
  noneLabel: string;
  onAdd?: (name: string) => Promise<string>;
  onChange: (value: string | null) => void;
  options: SelectOption[];
  value: string | null;
};

type Anchor = { x: number; y: number; width: number; height: number };

const MENU_GAP = 6;
const MENU_MIN_WIDTH = 200;
const MENU_PREFERRED_HEIGHT = 300;
const SCREEN_MARGIN = 12;

/**
 * Dropdown whose menu floats over the content below (it never pushes the
 * layout). The menu lives in a transparent modal anchored to the trigger, so
 * it is not clipped by the sheet's ScrollView; tapping outside closes it.
 */
export function SelectField({
  addLabel,
  addPlaceholder,
  containerStyle,
  label,
  noneLabel,
  onAdd,
  onChange,
  options,
  value,
}: SelectFieldProps) {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const { height: windowHeight, width: windowWidth } = useWindowDimensions();
  const triggerRef = useRef<ComponentRef<typeof View>>(null);
  const [anchor, setAnchor] = useState<Anchor | null>(null);
  const [adding, setAdding] = useState(false);
  const [keyboardHeight, setKeyboardHeight] = useState(0);
  const open = anchor !== null;
  const selected = options.find((option) => option.value === value);
  const rows: { value: string | null; label: string; group?: string }[] = [
    { value: null, label: noneLabel },
    ...options,
  ];

  const measure = () => {
    triggerRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height }));
  };

  const close = () => {
    setAnchor(null);
    setAdding(false);
  };

  const choose = (next: string | null) => {
    onChange(next);
    close();
  };

  // The sheet below also moves with the keyboard, so re-anchor once it settles.
  useEffect(() => {
    if (!open) return;
    const showEvent = Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow';
    const hideEvent = Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide';
    const remeasure = () =>
      requestAnimationFrame(() =>
        triggerRef.current?.measureInWindow((x, y, width, height) => setAnchor({ x, y, width, height })),
      );
    const subscriptions = [
      Keyboard.addListener(showEvent, (event) => setKeyboardHeight(event.endCoordinates.height)),
      Keyboard.addListener(hideEvent, () => setKeyboardHeight(0)),
      Keyboard.addListener('keyboardDidShow', remeasure),
      Keyboard.addListener('keyboardDidHide', remeasure),
    ];
    return () => {
      for (const subscription of subscriptions) subscription.remove();
    };
  }, [open]);

  let menuPosition: ViewStyle = {};
  if (anchor) {
    const width = Math.min(Math.max(anchor.width, MENU_MIN_WIDTH), windowWidth - SCREEN_MARGIN * 2);
    const left = Math.min(Math.max(anchor.x, SCREEN_MARGIN), windowWidth - width - SCREEN_MARGIN);
    const visibleBottom = windowHeight - Math.max(keyboardHeight, insets.bottom) - SCREEN_MARGIN;
    const spaceBelow = visibleBottom - (anchor.y + anchor.height + MENU_GAP);
    const spaceAbove = anchor.y - MENU_GAP - insets.top - SCREEN_MARGIN;
    const placeBelow = spaceBelow >= Math.min(MENU_PREFERRED_HEIGHT, 180) || spaceBelow >= spaceAbove;

    menuPosition = placeBelow
      ? { left, width, top: anchor.y + anchor.height + MENU_GAP, maxHeight: spaceBelow }
      : { left, width, bottom: windowHeight - anchor.y + MENU_GAP, maxHeight: spaceAbove };
  }

  return (
    <FormField label={label} style={containerStyle}>
      <Pressable
        accessibilityLabel={`${label}: ${selected?.label ?? noneLabel}`}
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        collapsable={false}
        onPress={measure}
        ref={triggerRef}
        style={[
          inputStyles.box,
          styles.trigger,
          { backgroundColor: colors.surface, borderColor: open ? colors.accent : colors.border },
        ]}>
        <AppText color={selected ? 'primary' : 'secondary'} numberOfLines={1} style={styles.flex}>
          {selected?.label ?? noneLabel}
        </AppText>
        <Ionicons color={colors.text} name={open ? 'chevron-up' : 'chevron-down'} size={16} />
      </Pressable>

      <Modal
        animationType="fade"
        navigationBarTranslucent
        onRequestClose={close}
        statusBarTranslucent
        transparent
        visible={open}>
        <Pressable accessibilityLabel="Fechar lista" onPress={close} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.menu,
            menuPosition,
            { backgroundColor: colors.surface, borderColor: colors.border },
          ]}>
          <ScrollView bounces={false} keyboardShouldPersistTaps="handled">
            {rows.map((row, index) => {
              const isSelected = row.value === value;
              const startsGroup = row.group !== undefined && row.group !== rows[index - 1]?.group;
              return (
                <Fragment key={row.value ?? 'none'}>
                  {startsGroup ? (
                    <AppText color="secondary" style={styles.groupLabel} variant="caption">
                      {row.group}
                    </AppText>
                  ) : null}
                  <Pressable
                    accessibilityRole="radio"
                    accessibilityState={{ checked: isSelected }}
                    onPress={() => choose(row.value)}
                    style={({ pressed }) => [styles.option, pressed && { backgroundColor: colors.muted }]}>
                    <AppText
                      color={row.value === null ? 'secondary' : 'primary'}
                      numberOfLines={1}
                      style={styles.flex}>
                      {row.label}
                    </AppText>
                    {isSelected ? <Ionicons color={colors.accent} name="checkmark" size={16} /> : null}
                  </Pressable>
                </Fragment>
              );
            })}
            {addLabel && onAdd ? <View style={[styles.divider, { backgroundColor: colors.border }]} /> : null}
            {!addLabel || !onAdd ? null : adding ? (
              <View style={styles.addRow}>
                <InlineAddInput
                  onCancel={() => setAdding(false)}
                  onSubmit={async (name) => choose(await onAdd(name))}
                  placeholder={addPlaceholder ?? addLabel}
                />
              </View>
            ) : (
              <Pressable accessibilityRole="button" onPress={() => setAdding(true)} style={styles.option}>
                <AppText color="accent" numberOfLines={1} variant="label">
                  + {addLabel}
                </AppText>
              </Pressable>
            )}
          </ScrollView>
        </View>
      </Modal>
    </FormField>
  );
}

const styles = StyleSheet.create({
  addRow: {
    padding: 8,
  },
  divider: {
    height: StyleSheet.hairlineWidth,
  },
  flex: {
    flex: 1,
  },
  groupLabel: {
    paddingBottom: 2,
    paddingHorizontal: 14,
    paddingTop: 10,
  },
  menu: {
    borderRadius: 13,
    borderWidth: 1,
    elevation: 6,
    overflow: 'hidden',
    position: 'absolute',
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  option: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 8,
    minHeight: 42,
    paddingHorizontal: 14,
  },
  trigger: {
    gap: 8,
    justifyContent: 'space-between',
  },
});
