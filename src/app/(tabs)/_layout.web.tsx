import { Tabs, TabList, TabTrigger, TabSlot, type TabTriggerSlotProps, type TabListProps } from 'expo-router/ui';
import { Pressable, View, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/theme';

export default function TabLayout() {
  return (
    <Tabs>
      <TabSlot style={{ height: '100%' }} />
      <TabList asChild>
        <CustomTabList>
          <TabTrigger name="today" href="/today" asChild>
            <TabButton>Today</TabButton>
          </TabTrigger>
          <TabTrigger name="history" href="/history" asChild>
            <TabButton>History</TabButton>
          </TabTrigger>
          <TabTrigger name="teams" href="/teams" asChild>
            <TabButton>Teams</TabButton>
          </TabTrigger>
          <TabTrigger name="settings" href="/settings" asChild>
            <TabButton>Settings</TabButton>
          </TabTrigger>
        </CustomTabList>
      </TabList>
    </Tabs>
  );
}

function TabButton({ children, isFocused, ...props }: TabTriggerSlotProps) {
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

function CustomTabList(props: TabListProps) {
  const { spacing, radius, layout } = useTheme();
  const styles = getStyles(spacing, radius, layout);

  return (
    <View {...props} style={styles.tabListContainer}>
      <ThemedView type="surfaceElevated" style={styles.innerContainer}>
        {props.children}
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
      bottom: 0,
      width: '100%',
      padding: spacing.lg,
      justifyContent: 'center',
      alignItems: 'center',
      flexDirection: 'row',
    },
    innerContainer: {
      paddingVertical: spacing.sm,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.full,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      maxWidth: layout?.maxContentWidth,
    },
    pressed: {
      opacity: 0.7,
    },
    tabButtonView: {
      paddingVertical: spacing.xs,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.large,
    },
  });
}
