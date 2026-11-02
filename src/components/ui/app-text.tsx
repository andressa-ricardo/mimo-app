import { StyleSheet, Text, type TextProps } from 'react-native';

import { useAppTheme } from '@/theme/theme-provider';

type TextVariant = 'body' | 'caption' | 'label' | 'section' | 'subtitle' | 'title';

type AppTextProps = TextProps & {
  variant?: TextVariant;
  color?: 'accent' | 'primary' | 'secondary';
};

export function AppText({
  variant = 'body',
  color = 'primary',
  style,
  ...props
}: AppTextProps) {
  const { colors } = useAppTheme();
  const textColor =
    color === 'accent' ? colors.accent : color === 'secondary' ? colors.textSecondary : colors.text;

  return <Text {...props} style={[styles.base, styles[variant], { color: textColor }, style]} />;
}

const styles = StyleSheet.create({
  base: {
    fontFamily: 'Inter_400Regular',
  },
  body: {
    fontSize: 14,
    lineHeight: 20,
  },
  caption: {
    fontSize: 11,
    lineHeight: 15,
  },
  label: {
    fontFamily: 'Inter_500Medium',
    fontSize: 12,
    lineHeight: 16,
  },
  section: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 16,
    lineHeight: 22,
  },
  subtitle: {
    fontFamily: 'Inter_600SemiBold',
    fontSize: 20,
    lineHeight: 27,
  },
  title: {
    fontFamily: 'Inter_700Bold',
    fontSize: 27,
    letterSpacing: -0.7,
    lineHeight: 34,
  },
});
