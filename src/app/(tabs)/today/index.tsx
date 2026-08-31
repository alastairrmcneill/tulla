import { useQuery } from '@tanstack/react-query';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BodyMapSheet } from '@/components/check-in/BodyMapSheet';
import { CheckInForm } from '@/components/check-in/CheckInForm';
import { DoneForToday } from '@/components/check-in/DoneForToday';
import { RetryBanner } from '@/components/retry-banner';
import { LogSessionFab } from '@/components/session/LogSessionFab';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { localDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import type { Tables } from '@/types/database';

/**
 * Today tab (plan 3.4/3.5/3.6, product spec §6.1, screen 3). Whether the
 * form or the "done for today" state shows is entirely query-driven (2.2's
 * binding rule) — CheckInForm's submit writes an optimistic row into this
 * exact query key (offline-first, see that component), which is what
 * actually flips this screen, not a navigation call.
 *
 * The body-map sheet is hosted here, not inside CheckInForm, so a future
 * done-state entry point could reach it too — but per design-reference (the
 * "Something hurts?" link lives only in the `notDone` block, not `isDone`),
 * it's only shown pre-check-in, matching the mockup rather than the
 * broader "regardless of check-in state" reading of product spec §6.2.
 */
export default function TodayScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout });
  const { user } = useAuth();
  const today = localDateString();
  const [bodyMapOpen, setBodyMapOpen] = useState(false);

  const query = useQuery({
    queryKey: ['daily_checkin', 'today', user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_checkins').select('*').eq('profile_id', user!.id).eq('date', today).maybeSingle();
      if (error) throw error;
      return data as Tables<'daily_checkins'> | null;
    },
  });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <RetryBanner query={query} onRetry={() => query.refetch()} />

        {query.isLoading ? (
          <ActivityIndicator style={styles.loading} color={colors.accent} />
        ) : query.data ? (
          <DoneForToday checkin={query.data} />
        ) : (
          <>
            <Pressable onPress={() => setBodyMapOpen(true)} accessibilityRole="button" style={styles.hurtsLink}>
              <ThemedText type="small" themeColor="textSecondary">
                Something hurts? Mark it on the body map
              </ThemedText>
            </Pressable>
            <CheckInForm onLowSoreness={() => setBodyMapOpen(true)} />
          </>
        )}
      </SafeAreaView>

      <BodyMapSheet visible={bodyMapOpen} onClose={() => setBodyMapOpen(false)} />
      <LogSessionFab />
    </ThemedView>
  );
}

function getStyles({ colors, spacing, radius, layout }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    loading: {
      flex: 1,
    },
    hurtsLink: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      marginHorizontal: layout.screenHorizontal,
      marginTop: spacing.sm,
      minHeight: layout.minTouchTarget,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.large,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
