import { StyleSheet, View } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useSyncStatus } from '@/hooks/use-sync-status';
import { useTheme } from '@/theme';

/**
 * Non-blocking "syncing" affordance (plan 2.1, product spec §13). Renders
 * nothing when the offline queue is empty. A consumer screen (3.4 check-in,
 * 3.6 body-map, 3.7 RPE log) drops this near the top of its own layout —
 * this component makes no positioning assumptions of its own.
 */
export function SyncIndicator() {
  const { pendingCount } = useSyncStatus();
  const { colors, spacing, radius } = useTheme();
  const styles = getStyles(colors, spacing, radius);

  if (pendingCount === 0) return null;

  return (
    <View style={styles.row} accessibilityLiveRegion="polite">
      <View style={styles.dot} />
      <ThemedText type="small" themeColor="textSecondary">
        Syncing…
      </ThemedText>
    </View>
  );
}

function getStyles(colors: ReturnType<typeof useTheme>['colors'], spacing: ReturnType<typeof useTheme>['spacing'], radius: ReturnType<typeof useTheme>['radius']) {
  return StyleSheet.create({
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    dot: {
      width: spacing.sm,
      height: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.status.warning.icon,
    },
  });
}
