import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { useTheme } from '@/theme';

/**
 * Single shared back-chevron button — every screen that needs a "go back"
 * affordance uses this, not its own ad hoc "‹ Label" text link, so they all
 * look and feel the same (same tap target, same press feedback). Icon-only
 * by design, matching Team Home's collapsing-header chevron exactly — that
 * screen has no adjacent label either.
 */
export function BackButton({ onPress }: { onPress: () => void }) {
  const { layout, opacity } = useTheme();
  const styles = getStyles({ layout, opacity });

  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      accessibilityLabel="Back"
      hitSlop={8}
      style={({ pressed }) => [styles.button, pressed && styles.buttonPressed]}
    >
      <ThemedText type="title" themeColor="accentText" style={styles.glyph}>
        ‹
      </ThemedText>
    </Pressable>
  );
}

function getStyles({ layout, opacity }: Pick<ReturnType<typeof useTheme>, 'layout' | 'opacity'>) {
  return StyleSheet.create({
    button: {
      width: layout.minTouchTarget - 12,
      height: layout.minTouchTarget - 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    buttonPressed: {
      opacity: opacity.pressed,
    },
    glyph: {
      marginTop: -2,
    },
  });
}
