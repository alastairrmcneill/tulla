import { version } from 'expo/package.json';
import { Image } from 'expo-image';
import { StyleSheet } from 'react-native';

import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { useTheme } from '@/theme';

export function WebBadge() {
  const { mode, spacing } = useTheme();
  const styles = getStyles(spacing);

  return (
    <ThemedView style={styles.container}>
      <ThemedText type="code" themeColor="textSecondary" style={styles.versionText}>
        v{version}
      </ThemedText>
      <Image
        source={
          mode === 'dark'
            ? require('@/assets/images/expo-badge-white.png')
            : require('@/assets/images/expo-badge.png')
        }
        style={styles.badgeImage}
      />
    </ThemedView>
  );
}

function getStyles(spacing: ReturnType<typeof useTheme>['spacing']) {
  return StyleSheet.create({
    container: {
      padding: spacing['3xl'],
      alignItems: 'center',
      gap: spacing.sm,
    },
    versionText: {
      textAlign: 'center',
    },
    badgeImage: {
      width: 123,
      aspectRatio: 123 / 24,
    },
  });
}
