import { Modal, Pressable, StyleSheet, View } from 'react-native';

import { BodyMap } from '@/components/charts/BodyMap';
import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

/**
 * Shared body-map bottom sheet (plan 3.6) — hosted once at the Today screen
 * level so both entry paths land on it identically:
 *
 * - Automatic: CheckInForm calls `onOpen` when soreness is picked at 1 or 2 (3.4).
 * - Manual: the persistent "Something hurts?" link, reachable regardless of
 *   check-in state (product spec §6.2) — which is exactly why this can't
 *   live inside CheckInForm alone; the done-state (3.5) needs it too.
 */
export function BodyMapSheet({ visible, onClose }: { visible: boolean; onClose: () => void }) {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout });

  return (
    <Modal visible={visible} transparent animationType="slide" onRequestClose={onClose}>
      <Pressable style={styles.scrim} onPress={onClose} accessibilityLabel="Close" accessibilityRole="button" />
      <View style={styles.sheet}>
        <View style={styles.header}>
          <ThemedText type="title">Where does it hurt?</ThemedText>
          <Pressable onPress={onClose} accessibilityRole="button" accessibilityLabel="Done" hitSlop={12}>
            <ThemedText type="smallBold" themeColor="accentText">
              DONE
            </ThemedText>
          </Pressable>
        </View>
        <ThemedText type="small" themeColor="textSecondary">
          Tap anywhere it&rsquo;s sore. One tap is enough — the rest is optional.
        </ThemedText>
        <BodyMap />
      </View>
    </Modal>
  );
}

function getStyles({ colors, spacing, radius, layout }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'>) {
  return StyleSheet.create({
    scrim: {
      flex: 1,
      backgroundColor: colors.scrim,
    },
    sheet: {
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: radius.extraLarge3,
      borderTopRightRadius: radius.extraLarge3,
      padding: spacing.xl,
      paddingBottom: spacing.xl + layout.tabBarHeight,
      gap: spacing.md,
      maxHeight: '85%',
    },
    header: {
      flexDirection: 'row',
      alignItems: 'center',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
  });
}
