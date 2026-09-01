import { useQuery } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { localDateString } from '@/lib/date';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

const COLUMNS = [
  { key: 'fatigue', label: 'FAT' },
  { key: 'sleep', label: 'SLE' },
  { key: 'muscle_soreness', label: 'MUS' },
  { key: 'stress', label: 'STR' },
  { key: 'mood', label: 'MOO' },
] as const;

/** All Responses (plan 4.9, product spec screen 17) — raw per-athlete list, RLS-gated the same as every other coach-side read (per-athlete consent + the coach's own active access). */
export default function AllResponsesScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const s = getStyles({ colors, spacing, radius, layout });
  const { id } = useLocalSearchParams<{ id: string }>();
  const today = localDateString();

  const query = useQuery({
    queryKey: ['daily_checkins', 'all_responses', id, today],
    enabled: !!id,
    queryFn: async () => {
      const { data: roster, error: rosterError } = await supabase.from('team_members').select('profile_id, profiles(name)').eq('team_id', id!).eq('role', 'athlete');
      if (rosterError) throw rosterError;

      const athleteIds = (roster ?? []).map((r) => r.profile_id);
      const { data: checkins, error: checkinsError } =
        athleteIds.length === 0
          ? { data: [], error: null }
          : await supabase.from('daily_checkins').select('*').in('profile_id', athleteIds).eq('date', today).order('created_at', { ascending: false });
      if (checkinsError) throw checkinsError;

      const byProfile = new Map(checkins?.map((c) => [c.profile_id, c]));
      return (roster ?? [])
        .map((r) => ({ profileId: r.profile_id, name: r.profiles?.name ?? 'Athlete', checkin: byProfile.get(r.profile_id) ?? null }))
        .sort((a, b) => {
          if (!a.checkin && !b.checkin) return 0;
          if (!a.checkin) return 1;
          if (!b.checkin) return -1;
          return b.checkin.created_at.localeCompare(a.checkin.created_at);
        });
    },
  });

  const rows = query.data ?? [];
  const checkedInCount = rows.filter((r) => r.checkin !== null).length;

  return (
    <ThemedView style={s.container}>
      <SafeAreaView style={s.safeArea}>
        <ScrollView contentContainerStyle={s.content}>
          <BackButton onPress={() => router.back()} />

          <ThemedText type="title" style={s.heading}>
            All responses
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            Today · {checkedInCount} of {rows.length} · newest first
          </ThemedText>

          <RetryBanner query={query} onRetry={() => query.refetch()} />

          <View style={s.headerRow}>
            <ThemedText type="smallBold" themeColor="textTertiary" style={s.athleteColHeader}>
              ATHLETE
            </ThemedText>
            {COLUMNS.map((c) => (
              <ThemedText key={c.key} type="smallBold" themeColor="textTertiary" style={s.colHeader}>
                {c.label}
              </ThemedText>
            ))}
          </View>

          <View style={s.card}>
            {rows.map((row, i) => (
              <View key={row.profileId} style={[s.row, i < rows.length - 1 && s.rowDivider]}>
                <ThemedText type="default" numberOfLines={1} style={s.athleteCol}>
                  {row.name}
                </ThemedText>
                {COLUMNS.map((c) => (
                  <ThemedText key={c.key} type="small" themeColor={row.checkin ? 'text' : 'textTertiary'} style={s.col}>
                    {row.checkin ? row.checkin[c.key] : '—'}
                  </ThemedText>
                ))}
              </View>
            ))}
          </View>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles({ colors, spacing, radius, layout }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'>) {
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
      gap: spacing.md,
    },
    heading: { marginTop: spacing.sm },
    headerRow: {
      flexDirection: 'row',
      paddingHorizontal: spacing.xs,
      marginTop: spacing.sm,
    },
    athleteColHeader: { flex: 2, letterSpacing: 0.8 },
    colHeader: { flex: 1, textAlign: 'center', letterSpacing: 0.5 },
    card: {
      borderRadius: radius.extraLarge,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      padding: spacing.md,
      gap: spacing.sm,
    },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    athleteCol: { flex: 2 },
    col: { flex: 1, textAlign: 'center' },
  });
}
