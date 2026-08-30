import { StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/theme';

/**
 * Placeholder (plan 1.13) — every route in the tree gets one of these until
 * its real epic/task lands. Not a shipped component; each screen task
 * replaces its own placeholder rather than building a new route.
 */
export function ScreenPlaceholder({ title }: { title: string }) {
  const { spacing } = useTheme();
  const styles = getStyles(spacing);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title" style={styles.text}>
          {title}
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.text}>
          Not built yet.
        </ThemedText>
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles(spacing: ReturnType<typeof useTheme>['spacing']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing['2xl'],
    },
    text: {
      textAlign: 'center',
    },
  });
}
