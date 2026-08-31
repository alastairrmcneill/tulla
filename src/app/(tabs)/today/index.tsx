import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckInForm } from '@/components/check-in/CheckInForm';
import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { localDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import type { Tables } from '@/types/database';

/**
 * Today tab (plan 3.4, product spec §6.1, screen 3). Whether the form or the
 * "done for today" state shows is entirely query-driven (2.2's binding
 * rule) — CheckInForm's submit writes an optimistic row into this exact
 * query key (offline-first, see that component), which is what actually
 * flips this screen, not a navigation call.
 *
 * The done-state UI itself (today's values plotted against baseline) is
 * 3.5's radar-chart component, not built yet — this renders a bare interim
 * placeholder for that branch, same "placeholder until the owning ticket
 * lands" convention as `<ScreenPlaceholder>`.
 */
export default function TodayScreen() {
  const { colors, spacing } = useTheme();
  const styles = getStyles(spacing);
  const { user } = useAuth();
  const today = localDateString();

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
          <ThemedView style={styles.done}>
            <ThemedText type="title" style={styles.centerText}>
              You&rsquo;re done for today
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.centerText}>
              Today&rsquo;s check-in is in.
            </ThemedText>
          </ThemedView>
        ) : (
          <CheckInForm />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles(spacing: ReturnType<typeof useTheme>['spacing']) {
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
    done: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
      paddingHorizontal: spacing['2xl'],
    },
    centerText: {
      textAlign: 'center',
    },
  });
}
