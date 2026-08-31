import { useQuery } from '@tanstack/react-query';
import { ActivityIndicator, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { CheckInForm } from '@/components/check-in/CheckInForm';
import { DoneForToday } from '@/components/check-in/DoneForToday';
import { RetryBanner } from '@/components/retry-banner';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { localDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import type { Tables } from '@/types/database';

/**
 * Today tab (plan 3.4/3.5, product spec §6.1, screen 3). Whether the form or
 * the "done for today" state shows is entirely query-driven (2.2's binding
 * rule) — CheckInForm's submit writes an optimistic row into this exact
 * query key (offline-first, see that component), which is what actually
 * flips this screen, not a navigation call.
 */
export default function TodayScreen() {
  const { colors } = useTheme();
  const styles = getStyles();
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
          <DoneForToday checkin={query.data} />
        ) : (
          <CheckInForm />
        )}
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles() {
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
  });
}
