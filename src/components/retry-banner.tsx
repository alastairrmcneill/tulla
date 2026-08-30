import { Pressable, StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { layout, useTheme } from '@/theme';

/**
 * Cached-state + retry affordance (plan 2.2, product spec §14: "Network
 * failure on any read: cached last-known state where possible, with a retry
 * affordance"). A read screen passes its `useQuery` result straight in —
 * this renders `null` whenever there's cached data to show instead, even if
 * that data is stale and the query is currently erroring.
 */
export function RetryBanner({ query, onRetry }: { query: { isError: boolean; data: unknown }; onRetry: () => void }) {
  const { colors, spacing, radius } = useTheme();
  const styles = getStyles(colors, spacing, radius);

  if (!query.isError || query.data !== undefined) return null;

  return (
    <View style={styles.banner}>
      <ThemedText type="small" themeColor="text" style={styles.message}>
        Couldn&apos;t load this. Check your connection and try again.
      </ThemedText>
      <Pressable onPress={onRetry} style={styles.retryButton} accessibilityRole="button" accessibilityLabel="Retry">
        <ThemedText type="smallBold" style={{ color: colors.status.danger.text }}>
          Retry
        </ThemedText>
      </Pressable>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors'], spacing: ReturnType<typeof useTheme>['spacing'], radius: ReturnType<typeof useTheme>['radius']) {
  return StyleSheet.create({
    banner: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.large,
      backgroundColor: colors.status.danger.surface,
      borderWidth: layout.hairline,
      borderColor: colors.status.danger.border,
    },
    message: {
      flex: 1,
    },
    retryButton: {
      minHeight: layout.minTouchTarget,
      minWidth: layout.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      paddingHorizontal: spacing.sm,
    },
  });
}
