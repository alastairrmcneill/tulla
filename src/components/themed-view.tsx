import { View, type ViewProps } from 'react-native';

import { useTheme } from '@/theme';

import type { ThemeColor } from './themed-text';

export type ThemedViewProps = ViewProps & {
  lightColor?: string;
  darkColor?: string;
  type?: ThemeColor;
};

export function ThemedView({ style, lightColor, darkColor, type, ...otherProps }: ThemedViewProps) {
  const { colors } = useTheme();

  return (
    <View style={[{ backgroundColor: colors[type ?? 'background'] as string }, style]} {...otherProps} />
  );
}
