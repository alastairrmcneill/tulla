import * as Device from 'expo-device';
import { Platform, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { AnimatedIcon } from '@/components/animated-icon';
import { HintRow } from '@/components/hint-row';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { WebBadge } from '@/components/web-badge';
import { useTheme } from '@/theme';

function getDevMenuHint() {
  if (Platform.OS === 'web') {
    return <ThemedText type="small">use browser devtools</ThemedText>;
  }
  if (Device.isDevice) {
    return (
      <ThemedText type="small">
        shake device or press <ThemedText type="code">m</ThemedText> in terminal
      </ThemedText>
    );
  }
  const shortcut = Platform.OS === 'android' ? 'cmd+m (or ctrl+m)' : 'cmd+d';
  return (
    <ThemedText type="small">
      press <ThemedText type="code">{shortcut}</ThemedText>
    </ThemedText>
  );
}

export default function HomeScreen() {
  const { spacing, radius, layout } = useTheme();
  const styles = getStyles(spacing, radius, layout);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedView style={styles.heroSection}>
          <AnimatedIcon />
          <ThemedText type="title" style={styles.title}>
            Welcome to&nbsp;Expo
          </ThemedText>
        </ThemedView>

        <ThemedText type="code" style={styles.code}>
          get started
        </ThemedText>

        <ThemedView type="surfaceElevated" style={styles.stepContainer}>
          <HintRow
            title="Try editing"
            hint={<ThemedText type="code">src/app/index.tsx</ThemedText>}
          />
          <HintRow title="Dev tools" hint={getDevMenuHint()} />
          <HintRow
            title="Fresh start"
            hint={<ThemedText type="code">npm run reset-project</ThemedText>}
          />
        </ThemedView>

        {Platform.OS === 'web' && <WebBadge />}
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles(
  spacing: ReturnType<typeof useTheme>['spacing'],
  radius: ReturnType<typeof useTheme>['radius'],
  layout: ReturnType<typeof useTheme>['layout'],
) {
  return StyleSheet.create({
    container: {
      flex: 1,
      justifyContent: 'center',
      flexDirection: 'row',
    },
    safeArea: {
      flex: 1,
      paddingHorizontal: spacing['2xl'],
      alignItems: 'center',
      gap: spacing.lg,
      paddingBottom: layout.tabBarHeight + spacing.lg,
      maxWidth: layout.maxContentWidth,
    },
    heroSection: {
      alignItems: 'center',
      justifyContent: 'center',
      flex: 1,
      paddingHorizontal: spacing['2xl'],
      gap: spacing['2xl'],
    },
    title: {
      textAlign: 'center',
    },
    code: {
      textTransform: 'uppercase',
    },
    stepContainer: {
      gap: spacing.lg,
      alignSelf: 'stretch',
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing['2xl'],
      borderRadius: radius.extraLarge2,
    },
  });
}
