import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useMemo, useState } from 'react';
import { ActivityIndicator, Animated, Pressable, ScrollView, StyleSheet, useWindowDimensions, View } from 'react-native';
import { LineChart } from 'react-native-gifted-charts';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';
import Svg, { Circle, Line, Path } from 'react-native-svg';

import { BackButton } from '@/components/back-button';
import { AthleteDetailView } from '@/components/team/AthleteDetailView';
import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useCoachAccess } from '@/hooks/use-coach-access';
import { getInitials } from '@/lib/text';
import { sendPush } from '@/lib/notifications';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import type { Tables } from '@/types/database';

type CoreMetric = 'fatigue' | 'sleep' | 'muscle_soreness' | 'stress' | 'mood';
const CORE_METRICS: { key: CoreMetric; short: string }[] = [
  { key: 'fatigue', short: 'FATIGUE' },
  { key: 'sleep', short: 'SLEEP' },
  { key: 'muscle_soreness', short: 'MUSCLES' },
  { key: 'stress', short: 'STRESS' },
  { key: 'mood', short: 'MOOD' },
];

/** Collapsing-header geometry (content height only — the safe-area top inset is added on top of both). Chosen so the shrink distance exactly matches the scroll distance it tracks, keeping the header's bottom edge and the scrolled content's top edge glued together through the transition — the standard non-overlay collapsing-header technique. */
const HEADER_EXPANDED_HEIGHT = 92;
const HEADER_COLLAPSED_HEIGHT = 52;
const HEADER_COLLAPSE_DISTANCE = HEADER_EXPANDED_HEIGHT - HEADER_COLLAPSED_HEIGHT;

function todayString(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

function addDays(dateStr: string, delta: number): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  date.setDate(date.getDate() + delta);
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}

/** "leg_left" -> "Left leg" — the coarse body-map regions (3.3's locked list) don't carry anatomical specificity finer than this. */
function formatBodyLocation(location: string): string {
  const [part, side] = location.split('_');
  if (!part) return location;
  return side ? `${side.charAt(0).toUpperCase() + side.slice(1)} ${part}` : part.charAt(0).toUpperCase() + part.slice(1);
}

/** Delta-based tone classification for the squad-signals rows. Thresholds aren't specified anywhere in the plan (same situation history/index.tsx's classifyWellnessScore already notes) — chosen to separate a negligible day-to-day wobble from a real drift. */
function classifyDelta(delta: number): 'danger' | 'warning' | 'success' | 'neutral' {
  if (Math.abs(delta) < 0.2) return 'neutral';
  if (delta <= -0.7) return 'danger';
  if (delta < 0) return 'warning';
  return 'success';
}

/**
 * Serves both screen 10 (Team Home, coach/admin — plan 4.5) and screen 14
 * (Team Info, read-only athlete view — plan 4.10): same route,
 * role-conditional on the viewer's own `team_members.role` for this team, per
 * this file's original placeholder comment. Tablet split-view also lives
 * here (product spec §4: flagged list left ~35%, athlete detail right ~65%).
 */
export default function TeamHomeScreen() {
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();

  const membershipQuery = useQuery({
    queryKey: ['team_members', 'self', id, user?.id],
    enabled: !!id && !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('role, consent_given_at').eq('team_id', id!).eq('profile_id', user!.id).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const teamQuery = useQuery({
    queryKey: ['teams', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('*').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });

  if (!id) return null;

  if (membershipQuery.isLoading || teamQuery.isLoading) {
    return (
      <ThemedView style={styles.loadingContainer}>
        <ActivityIndicator color="#C8FF3D" />
      </ThemedView>
    );
  }

  if (!membershipQuery.data || !teamQuery.data) return null;

  return membershipQuery.data.role === 'admin' ? (
    <CoachTeamHome teamId={id} teamName={teamQuery.data.name} />
  ) : (
    <AthleteTeamInfo teamId={id} teamName={teamQuery.data.name} />
  );
}

const styles = StyleSheet.create({
  loadingContainer: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
});

/* -------------------------------------------------------------------------- */
/* Coach view — Team Home                                                     */
/* -------------------------------------------------------------------------- */

function CoachTeamHome({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { colors, spacing, radius, layout, opacity } = useTheme();
  const s = getCoachStyles({ colors, spacing, radius, layout, opacity });
  const { width } = useWindowDimensions();
  const isTablet = width >= layout.tabletBreakpoint;
  const { profile } = useAuth();
  const coachAccess = useCoachAccess();
  const insets = useSafeAreaInsets();
  const today = todayString();

  const [missingOpen, setMissingOpen] = useState(false);
  const [selectedAthleteId, setSelectedAthleteId] = useState<string | null>(null);

  // Toast feedback for "Remind" — sendPush() gives no other visible
  // confirmation that the tap did anything.
  const [toast, setToast] = useState<{ message: string; tone: 'success' | 'danger' } | null>(null);
  const toastOpacity = useMemo(() => new Animated.Value(0), []);
  function showToast(message: string, tone: 'success' | 'danger') {
    setToast({ message, tone });
    toastOpacity.setValue(0);
    Animated.sequence([
      Animated.timing(toastOpacity, { toValue: 1, duration: 180, useNativeDriver: true }),
      Animated.delay(1800),
      Animated.timing(toastOpacity, { toValue: 0, duration: 220, useNativeDriver: true }),
    ]).start(({ finished }) => {
      if (finished) setToast(null);
    });
  }
  // Measured, not derived from useWindowDimensions() + a hand-subtracted
  // guess at the card's own padding — that guess is what was actually
  // running the chart off the right edge of the screen. This is the card's
  // real inner content width, no guessing.
  const [chartCardWidth, setChartCardWidth] = useState(0);

  // Collapsing header (kicker+title → compact bar) — built with the plain
  // Animated API tied to scroll offset, not the native Stack header (which
  // pulled in the OS's own translucent/glass material — not this app's
  // chrome). See HEADER_* constants for why the shrink distance matches the
  // collapse-transition scroll distance exactly.
  // useMemo, not useRef — this project's react-hooks/refs lint rule (react
  // compiler) flags reading `.current` during render, which interpolate()
  // calls below would otherwise do on every render.
  const scrollY = useMemo(() => new Animated.Value(0), []);
  const handleScroll = Animated.event([{ nativeEvent: { contentOffset: { y: scrollY } } }], { useNativeDriver: false });
  const headerContentHeight = scrollY.interpolate({ inputRange: [0, HEADER_COLLAPSE_DISTANCE], outputRange: [HEADER_EXPANDED_HEIGHT, HEADER_COLLAPSED_HEIGHT], extrapolate: 'clamp' });
  const expandedTitleOpacity = scrollY.interpolate({ inputRange: [0, HEADER_COLLAPSE_DISTANCE], outputRange: [1, 0], extrapolate: 'clamp' });
  const collapsedTitleOpacity = scrollY.interpolate({ inputRange: [0, HEADER_COLLAPSE_DISTANCE], outputRange: [0, 1], extrapolate: 'clamp' });

  const flaggedQuery = useQuery({
    queryKey: ['team_flagged_athletes', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_flagged_athletes', { p_team_id: teamId });
      if (error) throw error;
      return data;
    },
  });

  const rosterQuery = useQuery({
    queryKey: ['team_members', 'roster', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('profile_id, profiles(name)').eq('team_id', teamId).eq('role', 'athlete');
      if (error) throw error;
      return data;
    },
  });

  const athleteIds = useMemo(() => rosterQuery.data?.map((r) => r.profile_id) ?? [], [rosterQuery.data]);

  const checkinsTodayQuery = useQuery({
    queryKey: ['daily_checkins', 'team_today', teamId, today, athleteIds],
    enabled: athleteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_checkins').select('profile_id').in('profile_id', athleteIds).eq('date', today);
      if (error) throw error;
      return data;
    },
  });

  const trendQuery = useQuery({
    queryKey: ['daily_checkins', 'team_trend', teamId, today, athleteIds],
    enabled: athleteIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('daily_checkins')
        .select('date, wellness_score, fatigue, sleep, muscle_soreness, stress, mood')
        .in('profile_id', athleteIds)
        .gte('date', addDays(today, -13))
        .lte('date', today);
      if (error) throw error;
      return data;
    },
  });

  const baselineQuery = useQuery({
    queryKey: ['athlete_baseline_14', 'team', teamId, athleteIds],
    enabled: athleteIds.length > 0,
    queryFn: async () => {
      const results = await Promise.all(
        athleteIds.map(async (profileId) => {
          const { data, error } = await supabase.rpc('athlete_baseline_14', { p_profile_id: profileId });
          if (error) throw error;
          return data;
        }),
      );
      return results;
    },
  });

  const flagged = flaggedQuery.data ?? [];
  const roster = rosterQuery.data ?? [];
  const checkedInIds = new Set((checkinsTodayQuery.data ?? []).map((r) => r.profile_id));
  const missing = roster.filter((r) => !checkedInIds.has(r.profile_id));

  const trendSeries = useMemo(() => {
    const byDate = new Map<string, number[]>();
    for (const row of trendQuery.data ?? []) {
      if (row.wellness_score === null) continue;
      const arr = byDate.get(row.date) ?? [];
      arr.push(row.wellness_score);
      byDate.set(row.date, arr);
    }
    const points: { date: string; value: number | null }[] = [];
    for (let i = 13; i >= 0; i--) {
      const day = addDays(today, -i);
      const values = byDate.get(day);
      points.push({ date: day, value: values && values.length > 0 ? values.reduce((a, b) => a + b, 0) / values.length : null });
    }
    return points;
  }, [trendQuery.data, today]);

  const teamBaselineScore = useMemo(() => {
    const perAthlete = (baselineQuery.data ?? [])
      .map((rows) => {
        const means = rows.map((r) => r.mean);
        if (means.some((m) => m === null)) return null;
        const avg = (means as number[]).reduce((a, b) => a + b, 0) / means.length;
        return ((avg - 1) / 4) * 100;
      })
      .filter((v): v is number => v !== null);
    if (perAthlete.length === 0) return null;
    return perAthlete.reduce((a, b) => a + b, 0) / perAthlete.length;
  }, [baselineQuery.data]);

  // "% vs baseline" label on the team-average card: today's team average
  // against the same team-baseline average used for the dashed reference
  // line, so the two agree.
  const todayTeamScore = trendSeries.length > 0 ? trendSeries[trendSeries.length - 1]!.value : null;
  const vsBaselinePct = todayTeamScore !== null && teamBaselineScore !== null && teamBaselineScore !== 0 ? ((todayTeamScore - teamBaselineScore) / teamBaselineScore) * 100 : null;

  // Squad signals: per-core-metric team-average series over the same 14-day
  // window, for the sparkline + "today vs 14 days ago" delta rows.
  type MetricRow = { key: CoreMetric; short: string; points: number[]; delta: number; today: number };
  const metricRows = useMemo<MetricRow[]>(() => {
    const rows = trendQuery.data as (Pick<Tables<'daily_checkins'>, 'date'> & Record<CoreMetric, number>)[] | undefined;
    if (!rows) return [];

    return CORE_METRICS.map(({ key, short }) => {
      const byDate = new Map<string, number[]>();
      for (const row of rows) {
        const arr = byDate.get(row.date) ?? [];
        arr.push(row[key]);
        byDate.set(row.date, arr);
      }
      const points: number[] = [];
      for (let i = 13; i >= 0; i--) {
        const day = addDays(today, -i);
        const values = byDate.get(day);
        if (values && values.length > 0) points.push(values.reduce((a, b) => a + b, 0) / values.length);
      }
      const delta = points.length >= 2 ? points[points.length - 1]! - points[0]! : 0;
      const todayValue = points.length > 0 ? points[points.length - 1]! : 0;
      return { key, short, points, delta, today: todayValue };
    }).filter((row) => row.points.length > 0);
  }, [trendQuery.data, today]);

  async function handleRemind(athleteId: string, athleteName: string | null | undefined) {
    try {
      await sendPush(athleteId, 'Check-in reminder', `${profile?.name ?? 'Your coach'} would like to see today's check-in for ${teamName}.`, 'checkin_reminder');
      showToast(`Reminder sent to ${athleteName ?? 'athlete'}`, 'success');
    } catch {
      showToast("Couldn't send reminder — try again", 'danger');
    }
  }

  function handleSelectAthlete(athleteId: string) {
    if (isTablet) setSelectedAthleteId(athleteId);
    else router.push(`/team/${teamId}/athlete/${athleteId}`);
  }

  const flaggedList = (
    <View style={s.flaggedListWrap}>
      <View style={s.sectionHeaderRow}>
        <ThemedText type="smallBold" themeColor="textTertiary" style={s.sectionLabel}>
          WORTH A WORD TODAY · {flagged.length}
        </ThemedText>
        <ThemedText type="smallBold" themeColor="textTertiary" style={s.sectionLabelRight}>
          BY SEVERITY
        </ThemedText>
      </View>

      {flaggedQuery.isLoading ? (
        <ActivityIndicator color={colors.accent} />
      ) : flagged.length === 0 ? (
        <ThemedText type="small" themeColor="textSecondary" style={s.emptyFlagged}>
          {roster.length === 0 ? 'Waiting on your first check-ins.' : 'Nobody flagged today — nice.'}
        </ThemedText>
      ) : (
        <View style={s.card}>
          {flagged.map((row, i) => {
            // The row's icon reflects its highest-priority reason (pain >
            // below-baseline > rising load, same bucket the SQL function
            // already sorted by) — danger-red for pain, warning-amber
            // otherwise, never colour alone since a distinct glyph pairs
            // with it either way.
            const iconTone = row.pain_reported ? 'danger' : 'warning';
            return (
              <Pressable
                key={row.profile_id}
                onPress={() => handleSelectAthlete(row.profile_id)}
                accessibilityRole="button"
                style={[s.flaggedRow, i < flagged.length - 1 && s.rowDivider, selectedAthleteId === row.profile_id && s.flaggedRowSelected]}
              >
                <View style={[s.flaggedIcon, { backgroundColor: colors.status[iconTone].surface }]}>
                  <ThemedText type="smallBold" style={{ color: colors.status[iconTone].text }}>
                    {row.pain_reported ? '!' : '~'}
                  </ThemedText>
                </View>
                <View style={s.flaggedBody}>
                  <ThemedText type="default" style={s.flaggedName}>
                    {row.name ?? 'Athlete'}
                  </ThemedText>
                  <View style={s.chipRow}>
                    {row.pain_reported && <FlagChip label={`${row.pain_location ? formatBodyLocation(row.pain_location) : 'Reported'} pain`} tone="danger" />}
                    {row.below_baseline && <FlagChip label={`${row.below_baseline_metric?.replace('muscle_soreness', 'muscles') ?? 'Metric'} below baseline`} tone="warning" toCapitalize />}
                    {row.rising_load && <FlagChip label="Load rising fast" tone="warning" />}
                  </View>
                </View>
                <ThemedText themeColor="textTertiary">›</ThemedText>
              </Pressable>
            );
          })}
        </View>
      )}
    </View>
  );

  return (
    <ThemedView style={s.container}>
      {/* Not absolutely positioned over the scroll content — a plain sibling
          above it whose height shrinks by exactly the scrolled distance
          (HEADER_COLLAPSE_DISTANCE), so the header's bottom edge and the
          content's scrolled-up top edge stay glued together with no gap or
          overlap, the standard non-overlay collapsing-header technique. */}
      <Animated.View style={[s.pinnedHeader, { height: Animated.add(insets.top, headerContentHeight), paddingTop: insets.top }]}>
        <View style={s.pinnedHeaderRow}>
          <BackButton onPress={() => router.replace('/(tabs)/teams')} />

          <View style={s.pinnedTitleArea}>
            <Animated.View style={[s.pinnedTitleLayer, { opacity: expandedTitleOpacity }]} pointerEvents="none">
              <ThemedText type="smallBold" themeColor="accentText" style={s.kicker}>
                TEAM HOME
              </ThemedText>
              <ThemedText type="title" style={s.teamTitle} numberOfLines={1}>
                {teamName}
              </ThemedText>
            </Animated.View>
            <Animated.View style={[s.pinnedTitleLayer, s.pinnedTitleLayerCentered, { opacity: collapsedTitleOpacity }]} pointerEvents="none">
              <ThemedText type="subtitle" numberOfLines={1}>
                {teamName}
              </ThemedText>
            </Animated.View>
          </View>

          <Pressable onPress={() => router.push(`/team/${teamId}/roster`)} accessibilityRole="button" style={s.rosterButton}>
            <ThemedText type="small" themeColor="textSecondary">
              Roster
            </ThemedText>
          </Pressable>
        </View>
      </Animated.View>

      <SafeAreaView style={s.safeArea} edges={['bottom']}>
        <Animated.ScrollView contentContainerStyle={s.content} onScroll={handleScroll} scrollEventThrottle={16}>
          <RetryBanner query={flaggedQuery} onRetry={() => flaggedQuery.refetch()} />

          {coachAccess.isTrial && (
            <Pressable onPress={() => router.push(`/team/${teamId}/paywall`)} accessibilityRole="button" style={s.trialBanner}>
              <ThemedText type="title" themeColor="accentText" style={s.trialDays}>
                {coachAccess.daysRemaining}
              </ThemedText>
              <View style={s.trialText}>
                <ThemedText type="smallBold" themeColor="accentText">
                  day{coachAccess.daysRemaining === 1 ? '' : 's'} left in your trial
                </ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  Nothing is charged automatically
                </ThemedText>
              </View>
              <ThemedText type="smallBold" themeColor="accentText">
                SEE PLANS ›
              </ThemedText>
            </Pressable>
          )}

          {!isTablet && flaggedList}

          <Pressable onPress={() => setMissingOpen((v) => !v)} accessibilityRole="button" style={s.completionCard}>
            <View style={s.completionRow}>
              <ThemedText type="title">
                {checkedInIds.size}
                <ThemedText type="default" themeColor="textTertiary">
                  /{roster.length}
                </ThemedText>
              </ThemedText>
              <View style={s.completionText}>
                <ThemedText type="smallBold">checked in today</ThemedText>
                <ThemedText type="small" themeColor="textSecondary">
                  {missingOpen ? 'Tap a name to nudge them' : missing.length === 0 ? 'Everyone has checked in' : `${missing.length} still to go — tap to see who`}
                </ThemedText>
              </View>
              <ThemedText themeColor="textTertiary">{missingOpen ? '⌄' : '›'}</ThemedText>
            </View>

            {roster.length > 0 && (
              <View style={s.completionBar}>
                {roster.map((r, i) => (
                  <View key={r.profile_id} style={[s.completionSegment, i < checkedInIds.size && s.completionSegmentDone]} />
                ))}
              </View>
            )}

            {missingOpen && (
              <View style={s.missingList}>
                {missing.length === 0 ? (
                  <ThemedText type="small" themeColor="textSecondary">
                    Nobody missing.
                  </ThemedText>
                ) : (
                  missing.map((m) => (
                    <View key={m.profile_id} style={s.missingRow}>
                      <View style={s.missingAvatar}>
                        <ThemedText type="small">{getInitials(m.profiles?.name)}</ThemedText>
                      </View>
                      <ThemedText type="default" style={s.missingName}>
                        {m.profiles?.name ?? 'Athlete'}
                      </ThemedText>
                      <Pressable
                        onPress={() => handleRemind(m.profile_id, m.profiles?.name)}
                        accessibilityRole="button"
                        style={({ pressed }) => [s.remindButton, pressed && s.remindButtonPressed]}
                      >
                        <ThemedText type="smallBold" style={s.remindButtonText}>
                          REMIND
                        </ThemedText>
                      </Pressable>
                    </View>
                  ))
                )}
              </View>
            )}
          </Pressable>

          <View style={s.card}>
            <View style={s.sectionHeaderRow}>
              <ThemedText type="smallBold" themeColor="textTertiary" style={s.sectionLabel}>
                TEAM AVERAGE · 2 WEEKS
              </ThemedText>
              {vsBaselinePct !== null && (
                <ThemedText type="smallBold" style={{ color: colors.status[vsBaselinePct < 0 ? 'warning' : 'success'].text }}>
                  {vsBaselinePct < 0 ? '↓' : '↑'} {Math.round(Math.abs(vsBaselinePct))}% VS BASELINE
                </ThemedText>
              )}
            </View>
            {trendSeries.some((p) => p.value !== null) ? (
              <View style={s.chartClip} onLayout={(e) => setChartCardWidth(e.nativeEvent.layout.width)}>
                {chartCardWidth > 0 && (
                  <LineChart
                    data={teamBaselineScore !== null ? trendSeries.map(() => ({ value: teamBaselineScore })) : undefined}
                    data2={trendSeries.map((p) => ({ value: p.value ?? 0 }))}
                    height={88}
                    // Reserving yAxisLabelWidth explicitly and subtracting it
                    // from `width` ourselves — left to its own default, the
                    // library adds the y-axis label column *on top of*
                    // `width` rather than carving it out of it, which is what
                    // was pushing the chart past the card's (and the card
                    // past the screen's) right edge.
                    yAxisLabelWidth={36}
                    width={Math.max(0, chartCardWidth - 36)}
                    color={colors.textTertiary}
                    color2={colors.accent}
                    thickness={1.5}
                    thickness2={2.5}
                    dashWidth={4}
                    dashGap={4}
                    curved
                    hideDataPoints
                    yAxisTextStyle={{ color: colors.textTertiary, fontSize: 10 }}
                    xAxisColor={colors.border}
                    yAxisColor={colors.border}
                    rulesColor={colors.border}
                    noOfSections={3}
                    maxValue={100}
                    initialSpacing={4}
                    endSpacing={4}
                  />
                )}
              </View>
            ) : (
              <ThemedText type="small" themeColor="textSecondary">
                Not enough data yet.
              </ThemedText>
            )}
          </View>

          {isTablet && (
            <View style={s.splitRow}>
              <View style={s.leftPane}>{flaggedList}</View>
              <View style={s.rightPane}>
                {selectedAthleteId ? (
                  <AthleteDetailView teamId={teamId} athleteId={selectedAthleteId} />
                ) : (
                  <View style={s.rightPaneEmpty}>
                    <ThemedText type="small" themeColor="textSecondary">
                      Select an athlete to see their detail.
                    </ThemedText>
                  </View>
                )}
              </View>
            </View>
          )}

          {metricRows.length > 0 && (
            <View style={s.card}>
              <View style={s.sectionHeaderRow}>
                <ThemedText type="smallBold" themeColor="textTertiary" style={s.sectionLabel}>
                  SQUAD SIGNALS · BY QUESTION
                </ThemedText>
              </View>
              <View style={s.signalsList}>
                {metricRows.map((row) => {
                  const tone = classifyDelta(row.delta);
                  const toneColor = tone === 'neutral' ? colors.textSecondary : colors.status[tone].text;
                  return (
                    <View key={row.key} style={s.signalRow}>
                      <View style={s.signalLabelCol}>
                        <ThemedText type="smallBold" style={s.signalShort}>
                          {row.short}
                        </ThemedText>
                        <ThemedText type="small" style={{ color: toneColor }}>
                          {row.delta >= 0 ? '↑' : '↓'} {Math.abs(row.delta).toFixed(1)} · 14d
                        </ThemedText>
                      </View>
                      <View style={s.signalSparkCol}>
                        <Sparkline points={row.points} color={toneColor} />
                      </View>
                      <View style={s.signalTodayCol}>
                        <ThemedText type="title" style={[s.signalTodayValue, { color: toneColor }]}>
                          {row.today.toFixed(1)}
                        </ThemedText>
                        <ThemedText type="small" themeColor="textTertiary" style={s.signalTodayLabel}>
                          TODAY
                        </ThemedText>
                      </View>
                    </View>
                  );
                })}
              </View>
            </View>
          )}

          <View style={s.footerButtons}>
            <Pressable onPress={() => router.push(`/team/${teamId}/responses`)} accessibilityRole="button" style={s.footerButton}>
              <ThemedText type="smallBold">All responses</ThemedText>
            </Pressable>
            <Pressable onPress={() => router.push(`/team/${teamId}/questions`)} accessibilityRole="button" style={s.footerButton}>
              <ThemedText type="smallBold">Questions</ThemedText>
            </Pressable>
          </View>
        </Animated.ScrollView>
      </SafeAreaView>

      {toast && (
        <Animated.View style={[s.toast, { bottom: insets.bottom + spacing.lg, opacity: toastOpacity }]} pointerEvents="none">
          <View style={[s.toastPill, toast.tone === 'danger' && s.toastPillDanger]}>
            <ThemedText type="smallBold" themeColor={toast.tone === 'danger' ? undefined : 'accentText'} style={toast.tone === 'danger' ? { color: colors.status.danger.text } : undefined}>
              {toast.message}
            </ThemedText>
          </View>
        </Animated.View>
      )}
    </ThemedView>
  );
}

/** Small trend line for one squad-signals row — 1–5 domain mapped to the box's full height, with a faint dashed reference at the window's first value (mirrors the main chart's dashed-baseline convention) and a solid dot at today's value. */
function Sparkline({ points, color }: { points: number[]; color: string }) {
  const { colors } = useTheme();
  const width = 100;
  const height = 28;
  const toY = (v: number) => height - ((v - 1) / 4) * height;
  const toX = (i: number) => (points.length <= 1 ? 0 : (i / (points.length - 1)) * width);

  const path = points.map((v, i) => `${i === 0 ? 'M' : 'L'}${toX(i)},${toY(v)}`).join(' ');
  const referenceY = toY(points[0] ?? 3);
  const lastPoint = points[points.length - 1];

  return (
    <Svg width="100%" height={height} viewBox={`0 0 ${width} ${height}`}>
      <Line x1={0} y1={referenceY} x2={width} y2={referenceY} stroke={colors.border} strokeWidth={1} strokeDasharray="2,4" />
      <Path d={path} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
      {lastPoint !== undefined && <Circle cx={toX(points.length - 1)} cy={toY(lastPoint)} r={3.2} fill={color} />}
    </Svg>
  );
}

function FlagChip({ label, tone, toCapitalize }: { label: string; tone: 'danger' | 'warning'; toCapitalize?: boolean }) {
  const { colors, spacing, radius } = useTheme();
  const text = toCapitalize ? label.charAt(0).toUpperCase() + label.slice(1) : label;
  return (
    <View style={{ backgroundColor: colors.status[tone].surface, borderColor: colors.status[tone].border, borderWidth: 1, borderRadius: radius.small, paddingHorizontal: spacing.sm, paddingVertical: 2 }}>
      <ThemedText type="small" style={{ color: colors.status[tone].text, fontSize: 11 }}>
        {text}
      </ThemedText>
    </View>
  );
}

function getCoachStyles({ colors, spacing, radius, layout, opacity }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout' | 'opacity'>) {
  return StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    content: {
      width: '100%',
      // Plain maxContentWidth, matching every other screen's own content
      // container (Today/History/Teams) — the earlier `* 1.6` here (meant to
      // give the tablet split-view more room) was the actual cause of the
      // team-average chart and squad-signals rows rendering wider than the
      // phone screen and running off the right edge.
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      // The pinned header above is a real layout sibling (not an overlay),
      // so it already occupies its own space — this just needs a small
      // breathing gap, not a safe-area-sized one.
      paddingTop: spacing.lg,
      paddingBottom: layout.screenBottom,
      gap: spacing.lg,
    },
    pinnedHeader: {
      backgroundColor: colors.background,
      borderBottomWidth: layout.hairline,
      borderBottomColor: colors.border,
    },
    pinnedHeaderRow: {
      flex: 1,
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
      paddingHorizontal: layout.screenHorizontal,
    },
    pinnedTitleArea: {
      flex: 1,
      height: '100%',
    },
    pinnedTitleLayer: {
      position: 'absolute',
      left: 0,
      right: 0,
      top: 0,
      bottom: 0,
      justifyContent: 'center',
    },
    pinnedTitleLayerCentered: {
      justifyContent: 'center',
    },
    kicker: { letterSpacing: 1.2 },
    teamTitle: { marginTop: spacing.xs },
    rosterButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.medium,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    trialBanner: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      borderRadius: radius.extraLarge,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.status.success.border,
    },
    trialDays: { minWidth: 32 },
    trialText: { flex: 1, gap: spacing.xxs },
    completionCard: {
      padding: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    completionRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    completionText: { flex: 1, gap: spacing.xxs },
    completionBar: {
      flexDirection: 'row',
      gap: spacing.xs,
      marginTop: spacing.md,
    },
    completionSegment: {
      flex: 1,
      height: 7,
      borderRadius: radius.extraSmall,
      backgroundColor: colors.surfaceElevated,
    },
    completionSegmentDone: {
      backgroundColor: colors.accent,
    },
    missingList: {
      marginTop: spacing.md,
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
      gap: spacing.sm,
    },
    missingRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.sm,
    },
    missingAvatar: {
      width: 32,
      height: 32,
      borderRadius: radius.medium,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    missingName: { flex: 1 },
    remindButton: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      minHeight: layout.minTouchTarget - 12,
      justifyContent: 'center',
      borderRadius: radius.medium,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    remindButtonPressed: {
      opacity: opacity.pressed,
      backgroundColor: colors.accentSurface,
      borderColor: colors.accent,
    },
    remindButtonText: { fontSize: 11, letterSpacing: 0.5 },
    toast: {
      position: 'absolute',
      left: spacing.xl,
      right: spacing.xl,
      alignItems: 'center',
    },
    toastPill: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      borderRadius: radius.full,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.status.success.border,
      shadowColor: colors.shadowColor,
      shadowOpacity: 0.3,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    toastPillDanger: {
      backgroundColor: colors.status.danger.surface,
      borderColor: colors.status.danger.border,
    },
    card: {
      padding: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
      // Safety net: whatever the chart/sparklines compute internally, they
      // can never visually escape the card (and so never the screen).
      overflow: 'hidden',
    },
    chartClip: {
      width: '100%',
      overflow: 'hidden',
    },
    sectionHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    sectionLabel: { letterSpacing: 1.2 },
    sectionLabelRight: { letterSpacing: 1.2 },
    emptyFlagged: { paddingVertical: spacing.md },
    flaggedListWrap: { gap: spacing.sm },
    flaggedRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      paddingVertical: spacing.md,
    },
    flaggedRowSelected: {
      backgroundColor: colors.accentSurface,
      marginHorizontal: -spacing.lg,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.medium,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    flaggedIcon: {
      width: 40,
      height: 40,
      borderRadius: radius.medium,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    flaggedBody: { flex: 1, gap: spacing.xs },
    flaggedName: { fontWeight: '700' },
    chipRow: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
    splitRow: {
      flexDirection: 'row',
      gap: spacing.lg,
      alignItems: 'flex-start',
    },
    leftPane: {
      width: '35%',
    },
    rightPane: {
      flex: 1,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      padding: spacing.lg,
    },
    rightPaneEmpty: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      minHeight: 200,
    },
    footerButtons: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    footerButton: {
      flex: 1,
      minHeight: layout.minTouchTarget,
      alignItems: 'center',
      justifyContent: 'center',
      borderRadius: radius.large,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    signalsList: { gap: spacing.lg },
    signalRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    signalLabelCol: { width: 66, gap: spacing.xxs },
    signalShort: { letterSpacing: 0.8, fontSize: 12 },
    signalSparkCol: { flex: 1, minWidth: 0 },
    signalTodayCol: { width: 52, alignItems: 'flex-end' },
    signalTodayValue: { fontSize: 20, lineHeight: 22 },
    signalTodayLabel: { letterSpacing: 0.5, fontSize: 9 },
  });
}

/* -------------------------------------------------------------------------- */
/* Athlete view — Team Info (read-only)                                       */
/* -------------------------------------------------------------------------- */

function AthleteTeamInfo({ teamId, teamName }: { teamId: string; teamName: string }) {
  const { colors, spacing, radius, layout } = useTheme();
  const s = getInfoStyles({ colors, spacing, radius, layout });
  const { user } = useAuth();

  const accessQuery = useQuery({
    queryKey: ['team_has_access', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_has_access', { p_team_id: teamId });
      if (error) throw error;
      return data;
    },
  });

  const rosterCountQuery = useQuery({
    queryKey: ['team_members', 'count', teamId],
    queryFn: async () => {
      const { count, error } = await supabase.from('team_members').select('*', { count: 'exact', head: true }).eq('team_id', teamId);
      if (error) throw error;
      return count ?? 0;
    },
  });

  const adminQuery = useQuery({
    queryKey: ['team_members', 'admin_name', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('profiles(name)').eq('team_id', teamId).eq('role', 'admin').limit(1).maybeSingle();
      if (error) throw error;
      return data?.profiles?.name ?? null;
    },
  });

  const locked = accessQuery.data === false;

  async function handleLeave() {
    if (!user) return;
    await supabase.from('team_members').delete().eq('team_id', teamId).eq('profile_id', user.id);
    router.replace('/(tabs)/teams');
  }

  return (
    <ThemedView style={s.container}>
      <SafeAreaView style={s.safeArea} edges={['top', 'bottom']}>
        <ScrollView contentContainerStyle={s.content}>
          <BackButton onPress={() => router.replace('/(tabs)/teams')} />

          <View style={s.headerRow}>
            <View style={s.avatar}>
              <ThemedText type="title" themeColor="onAccent">
                {getInitials(teamName)}
              </ThemedText>
            </View>
            <View>
              <ThemedText type="title">{teamName}</ThemedText>
              <ThemedText type="small" themeColor="textSecondary">
                Coach {adminQuery.data ?? '—'} · {rosterCountQuery.data ?? 0} athletes
              </ThemedText>
            </View>
          </View>

          {locked && (
            <View style={s.lockedBanner}>
              <ThemedText type="smallBold" style={{ color: colors.status.warning.text }}>
                ~
              </ThemedText>
              <ThemedText type="small" style={[s.lockedText, { color: colors.status.warning.text }]}>
                Your coach&apos;s trial has ended — your check-ins still work, but they won&apos;t be shared with the team until they resubscribe.
              </ThemedText>
            </View>
          )}

          <ThemedText type="smallBold" themeColor="textTertiary" style={s.sectionLabel}>
            WHAT YOUR COACH CAN SEE
          </ThemedText>
          <View style={s.visibilityCard}>
            {['Daily wellness check-ins', 'Pain you report on the body map', 'Session RPE / load', "Your coach's custom questions"].map((label, i, arr) => (
              <View key={label} style={[s.visibilityRow, i < arr.length - 1 && s.rowDivider]}>
                <View style={[s.dot, { backgroundColor: colors.status.success.icon }]} />
                <ThemedText type="default" style={s.visibilityLabel}>
                  {label}
                </ThemedText>
              </View>
            ))}
          </View>

          <Pressable onPress={handleLeave} accessibilityRole="button" style={s.leaveButton}>
            <ThemedText type="smallBold" style={{ color: colors.status.danger.text }}>
              Leave team
            </ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function getInfoStyles({ colors, spacing, radius, layout }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'>) {
  return StyleSheet.create({
    container: { flex: 1 },
    safeArea: { flex: 1 },
    content: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      paddingBottom: layout.screenBottom,
      gap: spacing.lg,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatar: {
      width: 54,
      height: 54,
      borderRadius: radius.large,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    lockedBanner: {
      flexDirection: 'row',
      gap: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.status.warning.surface,
      borderWidth: 1,
      borderColor: colors.status.warning.border,
    },
    lockedText: { flex: 1 },
    sectionLabel: { letterSpacing: 1.2 },
    visibilityCard: {
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    visibilityRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    rowDivider: {
      borderBottomWidth: 1,
      borderBottomColor: colors.border,
    },
    dot: { width: 8, height: 8, borderRadius: radius.full },
    visibilityLabel: { flex: 1 },
    leaveButton: {
      minHeight: layout.minTouchTarget,
      borderRadius: radius.large,
      borderWidth: 1,
      borderColor: colors.status.danger.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
