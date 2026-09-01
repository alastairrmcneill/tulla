import { useQuery } from '@tanstack/react-query';
import { router } from 'expo-router';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, View } from 'react-native';
import { SafeAreaView, useSafeAreaInsets } from 'react-native-safe-area-context';

import { RetryBanner } from '@/components/retry-banner';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useCoachAccess } from '@/hooks/use-coach-access';
import { getInitials } from '@/lib/text';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/**
 * Teams tab (product spec §4, screen 7) — not its own CODING_PLAN.md ticket
 * (the plan jumps straight from 4.2's hook to 4.3's Create Team screen), but
 * every other epic-4 screen is only reachable through this list, so it's
 * built here as necessary supporting plumbing. Flagged for the plan doc, not
 * stubbed around per CLAUDE.md's workflow rule 2.
 */
type TeamRow = { teamId: string; role: string; name: string; sport: string | null };

export default function TeamsScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const insets = useSafeAreaInsets();
  const tabBarClearance = layout.tabBarHeight + insets.bottom;
  const styles = getStyles({ colors, spacing, radius, layout, tabBarClearance });
  const { user } = useAuth();
  const coachAccess = useCoachAccess();

  const query = useQuery({
    queryKey: ['team_members', 'mine', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('team_id, role, teams(id, name, sport)')
        .eq('profile_id', user!.id)
        .order('joined_at', { ascending: true });
      if (error) throw error;
      return (data ?? [])
        .filter((row): row is typeof row & { teams: NonNullable<(typeof row)['teams']> } => row.teams !== null)
        .map((row): TeamRow => ({ teamId: row.teams.id, role: row.role, name: row.teams.name, sport: row.teams.sport }));
    },
  });

  const teams = query.data ?? [];

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea} edges={['top']}>
        <ScrollView contentContainerStyle={styles.content}>
          <ThemedText type="title" style={styles.heading}>
            Teams
          </ThemedText>

          <RetryBanner query={query} onRetry={() => query.refetch()} />

          <Pressable
            onPress={() => router.push(coachAccess.isTrial || coachAccess.hasAccess ? '/team/create' : '/team/paywall')}
            accessibilityRole="button"
            style={styles.createCard}
          >
            <ThemedText type="smallBold" themeColor="accentText" style={styles.createTitle}>
              + CREATE A TEAM
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              See who needs attention today. Free trial, no card.
            </ThemedText>
          </Pressable>

          {query.isLoading ? (
            <ActivityIndicator style={styles.loading} color={colors.accent} />
          ) : (
            <>
              <ThemedText type="smallBold" themeColor="textTertiary" style={styles.sectionLabel}>
                YOUR TEAMS
              </ThemedText>

              {teams.length === 0 ? (
                <ThemedText type="small" themeColor="textSecondary" style={styles.empty}>
                  No teams yet — create one to start coaching, or join one with a code from your coach.
                </ThemedText>
              ) : (
                <View style={styles.list}>
                  {teams.map((team) => (
                    <TeamRowItem key={team.teamId} team={team} coachAccess={team.role === 'admin' ? coachAccess : null} />
                  ))}
                </View>
              )}
            </>
          )}

          <Pressable onPress={() => router.push('/team/join')} accessibilityRole="button" style={styles.joinCard}>
            <ThemedText type="smallBold">Join a team with a code</ThemedText>
          </Pressable>
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function TeamRowItem({ team, coachAccess }: { team: TeamRow; coachAccess: ReturnType<typeof useCoachAccess> | null }) {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout, tabBarClearance: 0 });

  const subtitle =
    coachAccess === null
      ? "You're an athlete here"
      : coachAccess.hasAccess
        ? coachAccess.isTrial
          ? `You coach · trial, ${coachAccess.daysRemaining} day${coachAccess.daysRemaining === 1 ? '' : 's'} left`
          : 'You coach'
        : 'You coach · trial ended';

  return (
    <Pressable onPress={() => router.push(`/team/${team.teamId}`)} accessibilityRole="button" style={styles.row}>
      <View style={[styles.avatar, coachAccess === null && styles.avatarMuted]}>
        <ThemedText type="smallBold" themeColor={coachAccess === null ? 'text' : 'onAccent'}>
          {getInitials(team.name)}
        </ThemedText>
      </View>
      <View style={styles.rowBody}>
        <ThemedText type="default" style={styles.rowName}>
          {team.name}
        </ThemedText>
        <ThemedText type="small" themeColor={coachAccess !== null && coachAccess.hasAccess ? 'accentText' : 'textSecondary'} style={styles.rowSubtitle}>
          {subtitle}
        </ThemedText>
      </View>
      <ThemedText type="default" themeColor="textTertiary">
        ›
      </ThemedText>
    </Pressable>
  );
}

function getStyles({
  colors,
  spacing,
  radius,
  layout,
  tabBarClearance,
}: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'> & { tabBarClearance: number }) {
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
      paddingBottom: layout.screenBottom + tabBarClearance,
    },
    heading: {
      marginBottom: spacing.xl,
    },
    createCard: {
      padding: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.status.success.border,
      gap: spacing.xs,
    },
    createTitle: {
      letterSpacing: -0.2,
    },
    loading: {
      marginTop: spacing['2xl'],
    },
    sectionLabel: {
      letterSpacing: 1.2,
      marginTop: spacing['2xl'],
      marginBottom: spacing.sm,
    },
    empty: {
      paddingVertical: spacing.lg,
    },
    list: {
      gap: spacing.sm,
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
      minHeight: layout.minTouchTarget,
      borderRadius: radius.extraLarge,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    avatar: {
      width: 40,
      height: 40,
      borderRadius: radius.medium,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    avatarMuted: {
      backgroundColor: colors.surfaceElevated,
    },
    rowBody: {
      flex: 1,
      gap: spacing.xxs,
    },
    rowName: {
      fontWeight: '700',
    },
    rowSubtitle: {},
    joinCard: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.extraLarge,
      borderWidth: 1,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      minHeight: layout.minTouchTarget,
      justifyContent: 'center',
    },
  });
}
