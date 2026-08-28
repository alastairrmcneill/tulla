import type { ReactNode } from 'react';
import { View, StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { useTheme } from '@/theme';

type HintRowProps = {
  title?: string;
  hint?: ReactNode;
};

export function HintRow({ title = 'Try editing', hint = 'app/index.tsx' }: HintRowProps) {
  const { spacing, radius } = useTheme();
  const styles = getStyles(spacing, radius);

  return (
    <View style={styles.stepRow}>
      <ThemedText type="small">{title}</ThemedText>
      <ThemedView type="accentSurface" style={styles.codeSnippet}>
        <ThemedText themeColor="textSecondary">{hint}</ThemedText>
      </ThemedView>
    </View>
  );
}

function getStyles(spacing: ReturnType<typeof useTheme>['spacing'], radius: ReturnType<typeof useTheme>['radius']) {
  return StyleSheet.create({
    stepRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
    },
    codeSnippet: {
      borderRadius: radius.small,
      paddingVertical: spacing.xxs,
      paddingHorizontal: spacing.sm,
    },
  });
}
