import Ionicons from '@expo/vector-icons/Ionicons';
import { Redirect, Tabs } from 'expo-router';
import { StyleSheet, View, type ColorValue } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { useAppTheme } from '@/theme/theme-provider';

type TabIconProps = {
  color: ColorValue;
  focused: boolean;
  name: keyof typeof Ionicons.glyphMap;
};

function TabIcon({ color, focused, name }: TabIconProps) {
  const { colors } = useAppTheme();
  const iconColor = typeof color === 'number' || color === null ? colors.textSecondary : color;

  return (
    <View style={[styles.iconContainer, focused && { backgroundColor: colors.accentSoft }]}>
      <Ionicons color={iconColor} name={name} size={20} />
    </View>
  );
}

export default function TabLayout() {
  const { colors, profile } = useAppTheme();
  const insets = useSafeAreaInsets();

  if (!profile.onboardingCompleted) return <Redirect href="/onboarding" />;

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        sceneStyle: { backgroundColor: colors.background },
        tabBarActiveTintColor: colors.accent,
        tabBarHideOnKeyboard: true,
        tabBarInactiveTintColor: colors.textSecondary,
        tabBarLabelStyle: styles.label,
        tabBarStyle: [
          styles.tabBar,
          {
            backgroundColor: colors.surface,
            borderTopColor: colors.border,
            height: 59 + insets.bottom,
            paddingBottom: Math.max(insets.bottom, 5),
          },
        ],
      }}>
      <Tabs.Screen
        name="index"
        options={{
          title: 'Home',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? 'home' : 'home-outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="wishlist"
        options={{
          title: 'Wishlist',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? 'heart' : 'heart-outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="finances"
        options={{
          title: 'Finanças',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? 'wallet' : 'wallet-outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="plans"
        options={{
          title: 'Planos',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon color={color} focused={focused} name={focused ? 'map' : 'map-outline'} />
          ),
        }}
      />
      <Tabs.Screen
        name="tasks"
        options={{
          title: 'Tasks',
          tabBarIcon: ({ color, focused }) => (
            <TabIcon
              color={color}
              focused={focused}
              name={focused ? 'checkbox' : 'checkbox-outline'}
            />
          ),
        }}
      />
    </Tabs>
  );
}

const styles = StyleSheet.create({
  iconContainer: {
    alignItems: 'center',
    borderRadius: 12,
    height: 27,
    justifyContent: 'center',
    width: 40,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 9,
  },
  tabBar: {
    borderTopWidth: StyleSheet.hairlineWidth,
    elevation: 0,
    height: 64,
    paddingBottom: 5,
    paddingTop: 5,
  },
});
