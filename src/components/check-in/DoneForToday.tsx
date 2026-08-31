import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';

import type { Metric } from '@/components/charts/RadarChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { RetryBanner } from '@/components/retry-banner';
import { SyncIndicator } from '@/components/sync-indicator';
import { ThemedText } from '@/components/themed-text';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import type { Tables } from '@/types/database';

const METRICS: Metric[] = ['fatigue', 'sleep', 'muscle_soreness', 'stress', 'mood'];

/**
 * "Done for today" state (plan 3.5, product spec §6.1) — replaces
 * CheckInForm once today's `daily_checkins` row exists (branch owned by
 * today/index.tsx, per 2.2's binding rule). Today's values plotted against
 * `athlete_baseline_14` (3.1) via 3.2's `RadarChart`.
 */
export function DoneForToday({ checkin }: { checkin: Tables<'daily_checkins'> }) {
  const { colors, spacing, radius, layout } = useTheme();
  const router = useRouter();
  const styles = getStyles({ colors, spacing, radius, layout });

  const baselineQuery = useQuery({
    queryKey: ['athlete_baseline_14', checkin.profile_id, checkin.date],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('athlete_baseline_14', {
        p_profile_id: checkin.profile_id,
        p_as_of: checkin.date,
      });
      if (error) throw error;
      return data;
    },
  });

  const current: Record<Metric, number> = {
    fatigue: checkin.fatigue,
    sleep: checkin.sleep,
    muscle_soreness: checkin.muscle_soreness,
    stress: checkin.stress,
    mood: checkin.mood,
  };

  // Baseline still loading (or errored with nothing cached): render the
  // chart with every axis "still building" rather than block the whole
  // screen on this one query — the check-in itself already saved fine.
  const baselineByMetric = new Map(baselineQuery.data?.map((row) => [row.metric, row.mean]));
  const baseline: Record<Metric, number | null> = Object.fromEntries(METRICS.map((m) => [m, baselineByMetric.get(m) ?? null])) as Record<Metric, number | null>;

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <SyncIndicator />

      <ThemedText type="title">You&rsquo;re done for today</ThemedText>

      <RetryBanner query={baselineQuery} onRetry={() => baselineQuery.refetch()} />

      <View style={styles.card}>
        <View style={styles.cardHeader}>
          <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
            TODAY VS BASELINE
          </ThemedText>
          <ThemedText type="smallBold" themeColor="textTertiary">
            14 DAYS
          </ThemedText>
        </View>
        <RadarChart current={current} baseline={baseline} />
      </View>

      <Pressable onPress={() => router.push('/history')} accessibilityRole="button" style={styles.historyButton}>
        <ThemedText type="smallBold" themeColor="accentText">
          See your history
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function getStyles({ colors, spacing, radius, layout }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'>) {
  return StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      paddingBottom: layout.screenBottom + layout.tabBarHeight,
      gap: spacing.lg,
    },
    card: {
      borderRadius: radius.extraLarge2,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    cardLabel: {
      letterSpacing: 1.2,
    },
    historyButton: {
      minHeight: layout.minTouchTarget,
      borderRadius: radius.large,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      paddingVertical: spacing.lg,
    },
  });
}
