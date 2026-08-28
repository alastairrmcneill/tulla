import {
  Tabs,
  TabList,
  TabTrigger,
  TabSlot,
  TabTriggerSlotProps,
  TabListProps,
} from 'expo-router/ui';
import { SymbolView } from 'expo-symbols';
import { Pressable, View, StyleSheet } from 'react-native';

import { ExternalLink } from './external-link';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';

import { useTheme } from '@/theme';

export default function AppTabs() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="home" href="/" asChild>
            <TabButton>Home</TabButton>
          </TabTrigger>
          <TabTrigger name="explore" href="/explore" asChild>
            <TabButton>Explore</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

export function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
  const { spacing, radius } = useTheme();
  const styles = getStyles(spacing, radius);

  return (
    <Pressable {...props} style={({ pressed }) => pressed && styles.pressed}>
      <ThemedView
        type={isFocused ? 'accentSurface' : 'surfaceElevated'}
        style={styles.tabButtonView}>
        <ThemedText type="small" themeColor={isFocused ? 'text' : 'textSecondary'}>
          {children}
        </ThemedText>
      </ThemedView>
    </Pressable>
  );
}

export function CustomTabList(props: TabListProps) {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles(spacing, radius, layout);

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="surfaceElevated" style={styles.innerContainer}>
        <ThemedText type="smallBold" style={styles.brandText}>
          Expo Starter
        </ThemedText>

        {props.children}

        <ExternalLink href="https://docs.expo.dev" asChild>
          <Pressable style={styles.externalPressable}>
            <ThemedText type="link">Docs</ThemedText>
            <SymbolView
              tintColor={colors.text}
              name={{ ios: 'arrow.up.right.square', web: 'link' }}
              size={12}
            />
          </Pressable>
        </ExternalLink>
      </ThemedView>
    </View>
  );
}

function getStyles(
  spacing: ReturnType<typeof useTheme>['spacing'],
  radius: ReturnType<typeof useTheme>['radius'],
  layout?: ReturnType<typeof useTheme>['layout'],
) {
  return StyleSheet.create({
    tabListContainer: {
      position: 'absolute',
      width: '100%',
      padding: spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
    innerContainer: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing['3xl'],
      borderRadius: radius.full,
      flexDirection: 'row',
      alignItems: 'center',
      flexGrow: 1,
      gap: spacing.sm,
      maxWidth: layout?.maxContentWidth,
    },
    brandText: {
      marginRight: 'auto',
    },
    pressed: {
      opacity: 0.7,
    },
    tabButtonView: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.large,
    },
    externalPressable: {
      flexDirection: 'row',
      justifyContent: 'center',
      alignItems: 'center',
      gap: spacing.xs,
      marginLeft: spacing.lg,
    },
  });
}
