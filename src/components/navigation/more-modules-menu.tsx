import Ionicons from '@expo/vector-icons/Ionicons';
import { type Href, router } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { AppText } from '@/components/ui/app-text';
import { useAppTheme } from '@/theme/theme-provider';

const modules: { href: Href; icon: keyof typeof Ionicons.glyphMap; label: string }[] = [
  { label: 'Metas', icon: 'disc-outline', href: '/goals' },
  { label: 'Calendário', icon: 'calendar-outline', href: '/calendar' },
  { label: 'Configurações', icon: 'settings-outline', href: '/settings' },
];

/** "⋯" header button that opens the secondary modules (Metas, Calendário, Configurações). */
export function MoreModulesMenu() {
  const { colors } = useAppTheme();
  const insets = useSafeAreaInsets();
  const [open, setOpen] = useState(false);

  const navigate = (href: Href) => {
    setOpen(false);
    router.push(href);
  };

  return (
    <>
      <Pressable
        accessibilityLabel="Mais módulos"
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        hitSlop={8}
        onPress={() => setOpen(true)}
        style={({ pressed }) => [styles.trigger, pressed && styles.pressed]}>
        <Ionicons color={colors.text} name="ellipsis-horizontal" size={21} />
      </Pressable>

      <Modal
        animationType="fade"
        navigationBarTranslucent
        onRequestClose={() => setOpen(false)}
        statusBarTranslucent
        transparent
        visible={open}>
        <Pressable accessibilityLabel="Fechar menu" onPress={() => setOpen(false)} style={StyleSheet.absoluteFill} />
        <View
          style={[
            styles.menu,
            { backgroundColor: colors.surface, borderColor: colors.border, top: insets.top + 52 },
          ]}>
          {modules.map((module, index) => (
            <Pressable
              accessibilityRole="menuitem"
              key={module.label}
              onPress={() => navigate(module.href)}
              style={({ pressed }) => [
                styles.item,
                index > 0 && { borderTopColor: colors.border, borderTopWidth: StyleSheet.hairlineWidth },
                pressed && { backgroundColor: colors.muted },
              ]}>
              <Ionicons color={colors.accent} name={module.icon} size={18} />
              <AppText>{module.label}</AppText>
            </Pressable>
          ))}
        </View>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  item: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 12,
    minHeight: 46,
    paddingHorizontal: 16,
  },
  menu: {
    borderRadius: 16,
    borderWidth: 1,
    elevation: 6,
    minWidth: 210,
    overflow: 'hidden',
    position: 'absolute',
    right: 16,
    shadowColor: '#000000',
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.1,
    shadowRadius: 12,
  },
  pressed: {
    opacity: 0.6,
  },
  trigger: {
    alignItems: 'center',
    height: 36,
    justifyContent: 'center',
    width: 36,
  },
});
