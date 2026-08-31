import { useQuery } from '@tanstack/react-query';
import { useEffect } from 'react';
import { StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { registerForPushNotificationsAsync } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { layout, useTheme } from '@/theme';
import type { Tables } from '@/types/database';

type Notification = Tables<'notifications'>;

/**
 * Notifications inbox (plan 2.3, product spec §6.11, screen 19). Mirrors
 * every push sent to this profile regardless of permission state — reads
 * via 2.2's shared query client, per that ticket's binding rule.
 */
export default function NotificationsScreen() {
  const { colors, spacing, radius } = useTheme();
  const styles = getStyles(colors, spacing, radius);
  const { user } = useAuth();

  useEffect(() => {
    void registerForPushNotificationsAsync();
  }, []);

  const query = useQuery({
    queryKey: ['notifications', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('notifications')
        .select('*')
        .eq('profile_id', user!.id)
        .order('created_at', { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  // Mark read on open — fire-and-forget, doesn't affect this render (an
  // athlete opening the inbox still sees the unread styling for the batch
  // they just opened; the next open reflects the updated state).
  useEffect(() => {
    const unreadIds = query.data?.filter((n) => !n.read).map((n) => n.id);
    if (!unreadIds || unreadIds.length === 0) return;
    void supabase.from('notifications').update({ read: true }).in('id', unreadIds);
  }, [query.data]);

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ThemedText type="title" style={styles.heading}>
          Inbox
        </ThemedText>

        <RetryBanner query={query} onRetry={() => query.refetch()} />

        {query.data?.length === 0 && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
            No notifications yet.
          </ThemedText>
        )}

        <View style={styles.list}>
          {query.data?.map((notification) => (
            <NotificationRow key={notification.id} notification={notification} />
          ))}
        </View>
      </SafeAreaView>
    </ThemedView>
  );
}

function NotificationRow({ notification }: { notification: Notification }) {
  const { colors, spacing, radius } = useTheme();
  const styles = getStyles(colors, spacing, radius);
  const unread = !notification.read;

  return (
    <View style={[styles.row, unread ? styles.rowUnread : styles.rowRead]}>
      <View style={[styles.dot, { backgroundColor: unread ? colors.status.success.icon : colors.borderStrong }]} />
      <View style={styles.rowBody}>
        <ThemedText type="small">{notification.title}</ThemedText>
        {notification.body && (
          <ThemedText type="small" themeColor="textSecondary">
            {notification.body}
          </ThemedText>
        )}
        <ThemedText type="small" themeColor="textTertiary" style={styles.time}>
          {formatRelativeTime(notification.created_at)}
        </ThemedText>
      </View>
    </View>
  );
}

function formatRelativeTime(iso: string): string {
  const date = new Date(iso);
  const now = new Date();
  const sameDay = date.toDateString() === now.toDateString();
  if (sameDay) return date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  const yesterday = new Date(now);
  yesterday.setDate(now.getDate() - 1);
  if (date.toDateString() === yesterday.toDateString()) return 'Yesterday';
  return date.toLocaleDateString(undefined, { weekday: 'short' });
}

function getStyles(colors: ReturnType<typeof useTheme>['colors'], spacing: ReturnType<typeof useTheme>['spacing'], radius: ReturnType<typeof useTheme>['radius']) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
    },
    heading: {
      marginBottom: spacing.xl,
    },
    empty: {
      marginTop: spacing.lg,
    },
    list: {
      gap: spacing.sm,
      paddingBottom: layout.screenBottom,
    },
    row: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.extraLarge,
      backgroundColor: colors.surface,
      borderWidth: layout.hairline,
    },
    rowUnread: {
      borderColor: colors.status.success.border,
    },
    rowRead: {
      borderColor: colors.border,
    },
    dot: {
      width: 8,
      height: 8,
      borderRadius: radius.full,
      marginTop: spacing.xs,
      flexShrink: 0,
    },
    rowBody: {
      flex: 1,
      gap: spacing.xxs,
    },
    time: {
      marginTop: spacing.xxs,
    },
  });
}
