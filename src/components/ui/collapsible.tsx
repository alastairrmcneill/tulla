import { SymbolView } from 'expo-symbols';
import { PropsWithChildren, useState } from 'react';
import { Pressable, StyleSheet } from 'react-native';
import Animated, { FadeIn } from 'react-native-reanimated';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/theme';

export function Collapsible({ children, title }: PropsWithChildren & { title: string }) {
  const [isOpen, setIsOpen] = useState(false);
  const { colors, spacing, radius } = useTheme();
  const styles = getStyles(spacing, radius);

  return (
    <ThemedView>
      <Pressable
        style={({ pressed }) => [styles.heading, pressed && styles.pressedHeading]}
        onPress={() => setIsOpen((value) => !value)}>
        <ThemedView type="surfaceElevated" style={styles.button}>
          <SymbolView
            name={{ ios: 'chevron.right', android: 'chevron_right', web: 'chevron_right' }}
            size={14}
            weight="bold"
            tintColor={colors.text}
            style={{ transform: [{ rotate: isOpen ? '-90deg' : '90deg' }] }}
          />
        </ThemedView>

        <ThemedText type="small">{title}</ThemedText>
      </Pressable>
      {isOpen && (
        <Animated.View entering={FadeIn.duration(200)}>
          <ThemedView type="surfaceElevated" style={styles.content}>
            {children}
          </ThemedView>
        </Animated.View>
      )}
    </ThemedView>
  );
}

function getStyles(spacing: ReturnType<typeof useTheme>['spacing'], radius: ReturnType<typeof useTheme>['radius']) {
  return StyleSheet.create({
    heading: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    pressedHeading: {
      opacity: 0.7,
    },
    button: {
      width: spacing['2xl'],
      height: spacing['2xl'],
      borderRadius: radius.medium,
      justifyContent: 'center',
      alignItems: 'center',
    },
    content: {
      marginTop: spacing.lg,
      borderRadius: radius.large,
      marginLeft: spacing['2xl'],
      padding: spacing['2xl'],
    },
  });
}
