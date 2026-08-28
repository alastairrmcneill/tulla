import { StyleSheet, Text, type TextProps } from 'react-native';

import { useTheme, type ColorTokens } from '@/theme';

export type ThemeColor = keyof Omit<ColorTokens, 'status' | 'glass'>;

export type ThemedTextProps = TextProps & {
  type?: 'default' | 'title' | 'small' | 'smallBold' | 'subtitle' | 'link' | 'linkPrimary' | 'code';
  themeColor?: ThemeColor;
};

export function ThemedText({ style, type = 'default', themeColor, ...rest }: ThemedTextProps) {
  const { colors, typography, fontFamily } = useTheme();
  const styles = getStyles(typography, fontFamily);

  return (
    <Text
      style={[
        { color: colors[(themeColor ?? (type === 'link' || type === 'linkPrimary' ? 'accentText' : 'text')) as ThemeColor] as string },
        type === 'default' && styles.default,
        type === 'title' && styles.title,
        type === 'small' && styles.small,
        type === 'smallBold' && styles.smallBold,
        type === 'subtitle' && styles.subtitle,
        type === 'link' && styles.link,
        type === 'linkPrimary' && styles.linkPrimary,
        type === 'code' && styles.code,
        style,
      ]}
      {...rest}
    />
  );
}

function getStyles(typography: ReturnType<typeof useTheme>['typography'], fontFamily: ReturnType<typeof useTheme>['fontFamily']) {
  return StyleSheet.create({
    small: typography.bodyMedium,
    smallBold: { ...typography.bodyMedium, fontWeight: typography.titleSmall.fontWeight },
    default: typography.bodyLarge,
    title: typography.headlineLarge,
    subtitle: typography.headlineSmall,
    link: typography.bodyMedium,
    linkPrimary: typography.labelMedium,
    code: { ...typography.mono, fontFamily: fontFamily.mono },
  });
}
