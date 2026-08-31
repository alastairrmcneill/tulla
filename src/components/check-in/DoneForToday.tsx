import { useQuery } from '@tanstack/react-query';
import { useRouter } from 'expo-router';
import { Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Metric } from '@/components/charts/RadarChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { useItemSyncStatus } from '@/hooks/use-item-sync-status';
import { formatDateKicker } from '@/lib/date';
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
  const insets = useSafeAreaInsets();
  // layout.tabBarHeight excludes the bottom safe-area inset (its own doc
  // comment) — NativeTabs floats above that inset, so it's added back here.
  const tabBarClearance = layout.tabBarHeight + insets.bottom;
  const styles = getStyles({ colors, spacing, radius, layout, tabBarClearance });
  const syncStatus = useItemSyncStatus(checkin.id);
  const syncLabel = syncStatus === 'syncing' ? 'SYNCING' : syncStatus === 'pending' ? 'SAVED ON DEVICE' : 'SAVED';

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

  // "Below usual" is a real baseline comparison (current < that metric's
  // athlete_baseline_14 mean), not the design-reference demo's raw <=2
  // threshold — only counted where a sufficient baseline actually exists.
  const sufficientMetrics = METRICS.filter((m) => baseline[m] !== null);
  const belowUsualCount = sufficientMetrics.filter((m) => current[m] < (baseline[m] as number)).length;
  const summary = sufficientMetrics.length === 0 ? null : belowUsualCount > 0 ? `${belowUsualCount} area${belowUsualCount === 1 ? '' : 's'} below your usual — an easy warm-up is the smart call.` : 'Everything at or above your usual. Good day to push.';

  return (
    <ScrollView contentContainerStyle={styles.container}>
      <ThemedText type="smallBold" themeColor="accentText" style={styles.kicker}>
        {formatDateKicker()}
      </ThemedText>
      <ThemedText type="title">You&rsquo;re done</ThemedText>

      <View style={styles.savedPill}>
        <ThemedText type="smallBold" themeColor="accentText">
          {syncLabel}
        </ThemedText>
      </View>

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
        {summary && (
          <ThemedText type="small" themeColor="textSecondary" style={styles.summary}>
            {summary}
          </ThemedText>
        )}
      </View>

      <Pressable onPress={() => router.push('/history')} accessibilityRole="button" style={styles.historyButton}>
        <ThemedText type="smallBold" themeColor="accentText">
          See your history
        </ThemedText>
      </Pressable>
    </ScrollView>
  );
}

function getStyles({ colors, spacing, radius, layout, tabBarClearance }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'> & { tabBarClearance: number }) {
  return StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      paddingBottom: layout.screenBottom + tabBarClearance,
      gap: spacing.md,
    },
    kicker: {
      letterSpacing: 1.4,
    },
    savedPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      backgroundColor: colors.accentSurface,
      marginBottom: spacing.sm,
    },
    card: {
      borderRadius: radius.extraLarge2,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
      marginTop: spacing.sm,
    },
    cardHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
    },
    cardLabel: {
      letterSpacing: 1.2,
    },
    summary: {
      borderTopWidth: 1,
      borderTopColor: colors.border,
      paddingTop: spacing.md,
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
      marginTop: spacing.sm,
    },
  });
}
