import { useQuery } from '@tanstack/react-query';
import { LinearGradient } from 'expo-linear-gradient';
import { useMemo } from 'react';
import { ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { Calendar, type DateData } from 'react-native-calendars';
import { SafeAreaView } from 'react-native-safe-area-context';

import { LogSessionFab } from '@/components/session/LogSessionFab';
import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { localDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Days of raw daily_checkins fetched — enough to cover the 30-point trend chart plus the 14-day lookback its first point needs, with margin for the calendar's currently-visible month. */
const FETCH_WINDOW_DAYS = 45;
const TREND_POINTS = 30;
const TREND_WINDOW_DAYS = 14;

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return localDateString(date);
}

function formatShortDate(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  return new Date(y, m - 1, d).toLocaleDateString('en-GB', { day: 'numeric', month: 'short' });
}

/**
 * The display-smoothing calc (3.1's own distinction from `athlete_baseline_14`,
 * which this deliberately does NOT reuse): trailing 14-day average
 * *including* the day itself, one point per day over the window. Exported
 * for verification (no test runner in this repo yet).
 */
export function trailingAverageSeries(rows: { date: string; wellness_score: number | null }[], windowDays: number, points: number, asOf: string): { date: string; value: number | null }[] {
  const byDate = new Map(rows.filter((r) => r.wellness_score !== null).map((r) => [r.date, r.wellness_score as number]));
  const series: { date: string; value: number | null }[] = [];
  for (let i = points - 1; i >= 0; i--) {
    const day = addDays(asOf, -i);
    let sum = 0;
    let count = 0;
    for (let w = 0; w < windowDays; w++) {
      const v = byDate.get(addDays(day, -w));
      if (v !== undefined) {
        sum += v;
        count++;
      }
    }
    series.push({ date: day, value: count > 0 ? sum / count : null });
  }
  return series;
}

export type LoadTrendDirection = 'up' | 'down' | 'flat';

/** Rolling 7-day windows (not calendar weeks — matches the rest of this app's lagged-window convention, e.g. 3.1's baseline). >10% higher = up, >10% lower = down. */
export function computeLoadTrend(rows: { logged_at: string; rpe_value: number }[], asOf: string): { thisWeek: number; lastWeek: number; direction: LoadTrendDirection } {
  const thisWeekStart = addDays(asOf, -6);
  const lastWeekStart = addDays(asOf, -13);
  const lastWeekEnd = addDays(asOf, -7);

  let thisWeek = 0;
  let lastWeek = 0;
  for (const row of rows) {
    const day = localDateString(new Date(row.logged_at));
    if (day >= thisWeekStart && day <= asOf) thisWeek += row.rpe_value;
    else if (day >= lastWeekStart && day <= lastWeekEnd) lastWeek += row.rpe_value;
  }

  let direction: LoadTrendDirection = 'flat';
  if (lastWeek === 0) direction = thisWeek > 0 ? 'up' : 'flat';
  else if (thisWeek > lastWeek * 1.1) direction = 'up';
  else if (thisWeek < lastWeek * 0.9) direction = 'down';

  return { thisWeek, lastWeek, direction };
}

/** Same 0–100 normalization as wellness_score itself (3.4), applied to the 5 metrics' athlete_baseline_14 means — null (hidden, not a misleading flat line at 0) unless every metric has a sufficient baseline. */
export function computeBaselineWellnessScore(rows: { metric: string; mean: number | null }[] | undefined): number | null {
  if (!rows || rows.length === 0) return null;
  const means = rows.map((r) => r.mean);
  if (means.some((m) => m === null)) return null;
  const avg = (means as number[]).reduce((sum, m) => sum + m, 0) / means.length;
  return ((avg - 1) / 4) * 100;
}

export type WellnessTier = 'low' | 'mid' | 'high';

/** Calendar cell tiers — thresholds aren't specified anywhere in the plan, so this splits the 0–100 wellness_score range across the app's 3 existing status roles (danger/warning/success) rather than inventing a 4th shade. */
export function classifyWellnessScore(score: number | null | undefined): WellnessTier | null {
  if (score === null || score === undefined) return null;
  if (score < 40) return 'low';
  if (score < 70) return 'mid';
  return 'high';
}

export default function HistoryScreen() {
  const { colors, spacing, radius, layout, typography } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout });
  const { width: windowWidth } = useWindowDimensions();
  const { user } = useAuth();
  const today = localDateString();
  const windowStart = addDays(today, -(FETCH_WINDOW_DAYS - 1));

  const checkinsQuery = useQuery({
    queryKey: ['daily_checkins', 'history', user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('date, wellness_score')
        .eq('profile_id', user!.id)
        .gte('date', windowStart)
        .lte('date', today)
        .order('date', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const rpeQuery = useQuery({
    queryKey: ['rpe_logs', 'history', user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('rpe_logs').select('logged_at, rpe_value').eq('profile_id', user!.id).gte('logged_at', addDays(today, -13)).order('logged_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const baselineQuery = useQuery({
    queryKey: ['athlete_baseline_14', user?.id, today],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('athlete_baseline_14', { p_profile_id: user!.id, p_as_of: today });
      if (error) throw error;
      return data;
    },
  });

  const checkins = checkinsQuery.data;
  const scoreByDate = useMemo(() => new Map((checkins ?? []).map((c) => [c.date, c.wellness_score])), [checkins]);

  const trendSeries = useMemo(() => (checkins ? trailingAverageSeries(checkins, TREND_WINDOW_DAYS, TREND_POINTS, today) : []), [checkins, today]);
  const trimmedTrend = useMemo(() => {
    const firstIndex = trendSeries.findIndex((p) => p.value !== null);
    return firstIndex === -1 ? [] : trendSeries.slice(firstIndex);
  }, [trendSeries]);

  const baselineScore = computeBaselineWellnessScore(baselineQuery.data);
  const loadTrend = rpeQuery.data ? computeLoadTrend(rpeQuery.data, today) : null;

  const isLoading = checkinsQuery.isLoading;
  const isEmpty = checkins !== undefined && checkins.length === 0;
  const chartWidth = Math.min(windowWidth, layout.maxContentWidth) - layout.screenHorizontal * 2 - spacing.lg * 2;

  function CalendarDay({ date }: { date?: DateData }) {
    if (!date) return <View />;
    const score = scoreByDate.get(date.dateString);
    const tier = classifyWellnessScore(score);
    // Solid icon-colour fill (not the translucent surface tint) — closer to
    // design-reference's vivid filled cells, still paired with a glyph so
    // it's never colour alone.
    const tierIcon = tier ? colors.status[tier === 'low' ? 'danger' : tier === 'mid' ? 'warning' : 'success'].icon : null;
    const glyph = tier === 'low' ? '▼' : tier === 'mid' ? '–' : tier === 'high' ? '▲' : '';
    const tierLabel = tier === 'low' ? 'below usual' : tier === 'mid' ? 'around usual' : tier === 'high' ? 'above usual' : 'no check-in';

    return (
      <View
        style={[styles.dayCell, tierIcon && { backgroundColor: tierIcon }]}
        accessible
        accessibilityLabel={`${formatShortDate(date.dateString)}, ${tierLabel}${score !== undefined && score !== null ? `, wellness score ${Math.round(score)}` : ''}`}
      >
        <ThemedText type="small" themeColor={tierIcon ? undefined : 'textTertiary'} style={tierIcon && styles.dayNumberOnTier}>
          {date.day}
        </ThemedText>
        {glyph !== '' && (
          <ThemedText style={styles.dayGlyph} accessibilityElementsHidden importantForAccessibility="no-hide-descendants">
            {glyph}
          </ThemedText>
        )}
      </View>
    );
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <RetryBanner query={checkinsQuery} onRetry={() => checkinsQuery.refetch()} />

        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.heading}>
            History
          </ThemedText>

          {!isLoading && isEmpty ? (
            <View style={styles.emptyState}>
              <ThemedText type="small" themeColor="textSecondary" style={styles.emptyText}>
                Nothing here yet — your trend line, calendar, and load will fill in once you&rsquo;ve logged a few check-ins.
              </ThemedText>
            </View>
          ) : (
            <>
              <View style={styles.card}>
                <View style={styles.cardHeader}>
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
                    WELLNESS SCORE
                  </ThemedText>
                  <ThemedText type="smallBold" themeColor="textTertiary">
                    LAST {TREND_POINTS} DAYS
                  </ThemedText>
                </View>

                {trimmedTrend.length > 1 && (
                  <LineChart
                    data={baselineScore !== null ? trimmedTrend.map(() => ({ value: baselineScore })) : undefined}
                    data2={trimmedTrend.map((p) => ({ value: p.value ?? 0 }))}
                    height={160}
                    width={chartWidth}
                    color={colors.textTertiary}
                    color2={colors.accent}
                    thickness={1.5}
                    thickness2={2.5}
                    dashWidth={4}
                    dashGap={4}
                    curved
                    hideDataPoints
                    hideDataPoints1={false}
                    dataPointsColor1={colors.accent}
                    dataPointsRadius1={3}
                    yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
                    xAxisLabelTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
                    xAxisColor={colors.border}
                    yAxisColor={colors.border}
                    rulesColor={colors.border}
                    noOfSections={4}
                    maxValue={100}
                    initialSpacing={8}
                    endSpacing={8}
                    xAxisLabelTexts={trimmedTrend.map((p, i) => (i % 7 === 0 ? formatShortDate(p.date) : ''))}
                  />
                )}

                <View style={styles.legendRow}>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, { backgroundColor: colors.accent }]} />
                    <ThemedText type="small" themeColor="textSecondary">
                      You
                    </ThemedText>
                  </View>
                  <View style={styles.legendItem}>
                    <View style={[styles.legendSwatch, styles.legendSwatchDashed, { borderColor: colors.textTertiary }]} />
                    <ThemedText type="small" themeColor="textSecondary">
                      {baselineScore !== null ? 'Baseline' : 'Baseline still building'}
                    </ThemedText>
                  </View>
                </View>
              </View>

              <View style={styles.card}>
                <Calendar
                  current={today}
                  firstDay={1}
                  dayComponent={CalendarDay}
                  theme={{
                    calendarBackground: 'transparent',
                    monthTextColor: colors.text,
                    textMonthFontWeight: typography.titleMedium.fontWeight,
                    arrowColor: colors.accentText,
                    textSectionTitleColor: colors.textTertiary,
                  }}
                  style={styles.calendar}
                />

                <View style={styles.legendGradientRow}>
                  <ThemedText type="small" themeColor="textTertiary" style={styles.legendGradientLabel}>
                    BELOW
                  </ThemedText>
                  <LinearGradient
                    colors={[colors.status.danger.icon, colors.status.warning.icon, colors.status.success.icon]}
                    start={{ x: 0, y: 0 }}
                    end={{ x: 1, y: 0 }}
                    style={styles.legendGradientBar}
                  />
                  <ThemedText type="small" themeColor="textTertiary" style={styles.legendGradientLabel}>
                    ABOVE
                  </ThemedText>
                </View>
              </View>

              {loadTrend && (
                <View style={[styles.card, styles.loadCard]}>
                  <View style={[styles.loadIconChip, { backgroundColor: colors.accentSurface }]}>
                    <ThemedText type="title" themeColor="accentText">
                      {loadTrend.direction === 'up' ? '↑' : loadTrend.direction === 'down' ? '↓' : '→'}
                    </ThemedText>
                  </View>
                  <View style={styles.loadCardText}>
                    <ThemedText type="subtitle">Load this week: {loadTrend.direction}</ThemedText>
                    <ThemedText type="small" themeColor="textSecondary">
                      {loadTrend.thisWeek} vs {loadTrend.lastWeek} last week (summed RPE)
                    </ThemedText>
                  </View>
                </View>
              )}
            </>
          )}
        </ScrollView>
      </SafeAreaView>

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
    content: {
      flexGrow: 1,
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      paddingBottom: layout.screenBottom + layout.tabBarHeight,
      gap: spacing.lg,
    },
    heading: {
      marginBottom: spacing.xs,
    },
    emptyState: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      paddingTop: spacing['4xl'],
    },
    emptyText: {
      textAlign: 'center',
      maxWidth: 280,
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
    legendRow: {
      flexDirection: 'row',
      gap: spacing.lg,
    },
    legendItem: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    legendSwatch: {
      width: 14,
      height: 3,
      borderRadius: radius.extraSmall,
    },
    legendSwatchDashed: {
      backgroundColor: 'transparent',
      borderTopWidth: 2,
      borderStyle: 'dashed',
      height: 0,
    },
    calendar: {
      borderRadius: radius.large,
    },
    legendGradientRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      marginTop: spacing.sm,
    },
    legendGradientLabel: {
      letterSpacing: 1,
    },
    legendGradientBar: {
      flex: 1,
      height: 6,
      borderRadius: radius.extraSmall,
    },
    loadCard: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    loadIconChip: {
      width: 46,
      height: 46,
      borderRadius: radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    loadCardText: {
      flex: 1,
      gap: spacing.xxs,
    },
    dayCell: {
      width: 32,
      height: 32,
      borderRadius: radius.small,
      alignItems: 'center',
      justifyContent: 'center',
    },
    dayNumberOnTier: {
      color: colors.onAccent,
    },
    dayGlyph: {
      fontSize: 8,
      lineHeight: 9,
      color: colors.onAccent,
    },
  });
}
