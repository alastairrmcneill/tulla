import { useQuery } from '@tanstack/react-query';
import { StyleSheet, View } from 'react-native';

import type { Metric } from '@/components/charts/RadarChart';
import { RadarChart } from '@/components/charts/RadarChart';
import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { getInitials } from '@/lib/text';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

const METRICS: Metric[] = ['fatigue', 'sleep', 'muscle_soreness', 'stress', 'mood'];

/** "hamstring, severe" chip label from a body_map_entries row. */
function formatLocation(location: string): string {
  return location.replace(/_/g, ' ');
}

/**
 * Athlete Detail (plan 4.6, product spec §6.7) — same component whether it's
 * pushed as a full-screen phone route (`team/[id]/athlete/[athleteId].tsx`)
 * or embedded as the tablet split-view's right pane (`team/[id]/index.tsx`),
 * per that ticket's own "same component, different container" requirement.
 * Entirely read-only from the coach's side.
 */
export function AthleteDetailView({ teamId, athleteId }: { teamId: string; athleteId: string }) {
  const { colors, spacing, radius } = useTheme();
  const styles = getStyles({ colors, spacing, radius });

  const profileQuery = useQuery({
    queryKey: ['profiles', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('profiles').select('name').eq('id', athleteId).single();
      if (error) throw error;
      return data;
    },
  });

  const flaggedQuery = useQuery({
    queryKey: ['team_flagged_athletes', teamId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_flagged_athletes', { p_team_id: teamId });
      if (error) throw error;
      return data;
    },
  });

  const checkinQuery = useQuery({
    queryKey: ['daily_checkins', 'athlete_detail', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('daily_checkins').select('*').eq('profile_id', athleteId).order('date', { ascending: false }).limit(1).maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  const baselineQuery = useQuery({
    queryKey: ['athlete_baseline_14', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase.rpc('athlete_baseline_14', { p_profile_id: athleteId });
      if (error) throw error;
      return data;
    },
  });

  const bodyMapQuery = useQuery({
    queryKey: ['body_map_entries', 'athlete_detail', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('body_map_entries').select('*').eq('profile_id', athleteId).order('date', { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const rpeQuery = useQuery({
    queryKey: ['rpe_logs', 'athlete_detail', athleteId],
    queryFn: async () => {
      const { data, error } = await supabase.from('rpe_logs').select('*').eq('profile_id', athleteId).order('logged_at', { ascending: false }).limit(10);
      if (error) throw error;
      return data;
    },
  });

  const questionResponsesQuery = useQuery({
    queryKey: ['custom_question_responses', 'athlete_detail', checkinQuery.data?.id],
    enabled: !!checkinQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('custom_question_responses')
        .select('response_value, custom_questions(question_text)')
        .eq('checkin_id', checkinQuery.data!.id);
      if (error) throw error;
      return data;
    },
  });

  const flaggedRow = flaggedQuery.data?.find((r) => r.profile_id === athleteId) ?? null;
  const checkin = checkinQuery.data;
  const baselineByMetric = new Map(baselineQuery.data?.map((row) => [row.metric, row.mean]));
  const baseline: Record<Metric, number | null> = Object.fromEntries(METRICS.map((m) => [m, baselineByMetric.get(m) ?? null])) as Record<Metric, number | null>;
  const current: Record<Metric, number> = checkin
    ? { fatigue: checkin.fatigue, sleep: checkin.sleep, muscle_soreness: checkin.muscle_soreness, stress: checkin.stress, mood: checkin.mood }
    : { fatigue: 0, sleep: 0, muscle_soreness: 0, stress: 0, mood: 0 };

  const maxRpe = Math.max(1, ...(rpeQuery.data ?? []).map((r) => r.rpe_value));
  const rpeSessions = [...(rpeQuery.data ?? [])].reverse();

  return (
    <View style={styles.container}>
      <RetryBanner query={checkinQuery} onRetry={() => checkinQuery.refetch()} />

      <View style={styles.headerRow}>
        <View style={[styles.avatar, flaggedRow && styles.avatarFlagged]}>
          <ThemedText type="smallBold" themeColor={flaggedRow ? 'text' : 'onAccent'}>
            {getInitials(profileQuery.data?.name)}
          </ThemedText>
        </View>
        <View style={styles.headerText}>
          <ThemedText type="title">{profileQuery.data?.name ?? 'Athlete'}</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            {checkin ? `Checked in ${new Date(checkin.created_at).toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' })}` : 'Not checked in today'}
          </ThemedText>
        </View>
      </View>

      {flaggedRow && (
        <View style={styles.flagBanner}>
          <ThemedText type="smallBold" style={{ color: colors.status.danger.text }}>
            !
          </ThemedText>
          <ThemedText type="small" style={[styles.flagText, { color: colors.status.danger.text }]}>
            {[
              flaggedRow.pain_reported && `${flaggedRow.pain_severity} pain reported`,
              flaggedRow.below_baseline && `below baseline on ${flaggedRow.below_baseline_metric?.replace('_', ' ')}`,
              flaggedRow.rising_load && 'training load rising fast',
            ]
              .filter(Boolean)
              .join(', ')}
            .
          </ThemedText>
        </View>
      )}

      <View style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
          TODAY VS THEIR BASELINE
        </ThemedText>
        <RadarChart current={current} baseline={baseline} />
      </View>

      <View style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
          PAIN REPORTED
        </ThemedText>
        {bodyMapQuery.data?.length ? (
          <View style={styles.painList}>
            {bodyMapQuery.data.map((entry) => (
              <View key={entry.id} style={styles.painRow}>
                <View
                  style={[
                    styles.painIcon,
                    { backgroundColor: entry.severity === 'severe' ? colors.status.danger.surface : entry.severity === 'moderate' ? colors.status.warning.surface : colors.surfaceElevated },
                  ]}
                >
                  <ThemedText type="small" style={{ color: entry.severity === 'severe' ? colors.status.danger.text : entry.severity === 'moderate' ? colors.status.warning.text : colors.textSecondary }}>
                    {entry.severity.slice(0, 3).toUpperCase()}
                  </ThemedText>
                </View>
                <View style={styles.painBody}>
                  <ThemedText type="default">
                    {formatLocation(entry.location)} · {entry.severity}
                  </ThemedText>
                  <ThemedText type="small" themeColor="textSecondary">
                    {entry.date}
                    {entry.note ? ` · "${entry.note}"` : ''}
                  </ThemedText>
                </View>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No pain reported recently.
          </ThemedText>
        )}
      </View>

      <View style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
          SESSION LOAD · RPE
        </ThemedText>
        {rpeSessions.length ? (
          <View style={styles.rpeBars}>
            {rpeSessions.map((r) => (
              <View key={r.id} style={styles.rpeBarTrack}>
                <View style={[styles.rpeBar, { height: `${(r.rpe_value / maxRpe) * 100}%`, backgroundColor: r.rpe_value >= 8 ? colors.status.danger.icon : colors.accent }]} />
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No sessions logged recently.
          </ThemedText>
        )}
      </View>

      <View style={styles.card}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.cardLabel}>
          COACH&apos;S QUESTIONS
        </ThemedText>
        {questionResponsesQuery.data?.length ? (
          <View style={styles.painList}>
            {questionResponsesQuery.data.map((r, i) => (
              <View key={i}>
                <ThemedText type="small" themeColor="textSecondary">
                  {r.custom_questions?.question_text}
                </ThemedText>
                <ThemedText type="default">{r.response_value}</ThemedText>
              </View>
            ))}
          </View>
        ) : (
          <ThemedText type="small" themeColor="textSecondary">
            No answers yet today.
          </ThemedText>
        )}
      </View>
    </View>
  );
}

function getStyles({ colors, spacing, radius }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius'>) {
  return StyleSheet.create({
    container: {
      gap: spacing.md,
    },
    headerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    avatar: {
      width: 52,
      height: 52,
      borderRadius: radius.large,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarFlagged: {
      backgroundColor: colors.status.danger.surface,
    },
    headerText: {
      flex: 1,
      gap: spacing.xxs,
    },
    flagBanner: {
      flexDirection: 'row',
      gap: spacing.sm,
      padding: spacing.md,
      borderRadius: radius.large,
      backgroundColor: colors.status.danger.surface,
      borderWidth: 1,
      borderColor: colors.status.danger.border,
    },
    flagText: {
      flex: 1,
    },
    card: {
      borderRadius: radius.extraLarge2,
      padding: spacing.lg,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    cardLabel: {
      letterSpacing: 1.2,
    },
    painList: {
      gap: spacing.md,
    },
    painRow: {
      flexDirection: 'row',
      gap: spacing.md,
      alignItems: 'center',
    },
    painIcon: {
      width: 36,
      height: 36,
      borderRadius: radius.medium,
      alignItems: 'center',
      justifyContent: 'center',
    },
    painBody: {
      flex: 1,
      gap: spacing.xxs,
    },
    rpeBars: {
      flexDirection: 'row',
      alignItems: 'flex-end',
      gap: spacing.sm,
      height: 82,
    },
    rpeBarTrack: {
      flex: 1,
      height: '100%',
      justifyContent: 'flex-end',
    },
    rpeBar: {
      width: '100%',
      borderRadius: radius.extraSmall,
      minHeight: 4,
    },
  });
}
