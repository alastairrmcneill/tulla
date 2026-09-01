import { useQuery, useQueryClient } from '@tanstack/react-query';
import { Redirect, router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/**
 * Consent screen (plan 4.11, product spec §6.10, screen 16) — reached both
 * via `team/join.tsx`'s manual code entry and via the `tulla://join/[code]`
 * deep link (1.8's scheme-routing pattern); both converge here.
 *
 * A deep link can land here before the root `/` auth gate (`src/app/index.tsx`)
 * ever runs, so this screen guards its own session requirement rather than
 * assuming one.
 */
export default function JoinConsentScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout });
  const { code } = useLocalSearchParams<{ code: string }>();
  const { user, loading: authLoading } = useAuth();
  const queryClient = useQueryClient();
  const [joining, setJoining] = useState(false);

  const lookupQuery = useQuery({
    queryKey: ['team_lookup_by_join_code', code],
    enabled: !!user && !!code,
    queryFn: async () => {
      const { data, error } = await supabase.rpc('team_lookup_by_join_code', { p_join_code: code! });
      if (error) throw error;
      return data?.[0] ?? null;
    },
  });

  const membershipQuery = useQuery({
    queryKey: ['team_members', 'consent_check', user?.id, lookupQuery.data?.team_id],
    enabled: !!user && !!lookupQuery.data,
    queryFn: async () => {
      const { data, error } = await supabase
        .from('team_members')
        .select('consent_given_at')
        .eq('team_id', lookupQuery.data!.team_id)
        .eq('profile_id', user!.id)
        .maybeSingle();
      if (error) throw error;
      return data;
    },
  });

  if (authLoading) return null;
  if (!user) return <Redirect href="/(auth)/log-in" />;

  // Already consented on a prior visit to this link/code — skip straight
  // past, one-time-per-team (locked decision).
  if (membershipQuery.data?.consent_given_at) {
    return <Redirect href={`/team/${lookupQuery.data!.team_id}`} />;
  }

  async function handleJoin() {
    if (!user || !lookupQuery.data || joining) return;
    setJoining(true);
    try {
      const { error } = await supabase
        .from('team_members')
        .insert({ team_id: lookupQuery.data.team_id, profile_id: user.id, role: 'athlete', consent_given_at: new Date().toISOString() });
      if (error) throw error;
      await queryClient.invalidateQueries({ queryKey: ['team_members', 'mine', user.id] });
      router.replace(`/team/${lookupQuery.data.team_id}`);
    } finally {
      setJoining(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {lookupQuery.isLoading || membershipQuery.isLoading ? (
          <ActivityIndicator style={styles.loading} color={colors.accent} />
        ) : !lookupQuery.data ? (
          <View style={styles.notFound}>
            <ThemedText type="title">Team not found</ThemedText>
            <ThemedText type="small" themeColor="textSecondary" style={styles.notFoundBody}>
              That join code doesn&apos;t match a team. Check it with your coach.
            </ThemedText>
            <Pressable onPress={() => router.replace('/(tabs)/teams')} accessibilityRole="button" style={styles.notNowButton}>
              <ThemedText type="smallBold">Back to Teams</ThemedText>
            </Pressable>
          </View>
        ) : (
          <>
            <View style={styles.body}>
              <ThemedText type="smallBold" themeColor="accentText" style={styles.kicker}>
                BEFORE YOU JOIN
              </ThemedText>
              <ThemedText type="title" style={styles.teamName}>
                {lookupQuery.data.team_name}
              </ThemedText>
              <ThemedText type="small" themeColor="textSecondary" style={styles.coachedBy}>
                Coached by {lookupQuery.data.admin_name ?? 'their coach'}
              </ThemedText>

              <View style={styles.consentCard}>
                <ThemedText type="default" style={styles.consentText}>
                  Your coach, <ThemedText type="default" style={styles.bold}>{lookupQuery.data.admin_name ?? 'the coach'}</ThemedText>, will be able to see your daily
                  check-in answers — including your wellness ratings, any pain you report, and answers to their custom questions — for{' '}
                  <ThemedText type="default" style={styles.bold}>{lookupQuery.data.team_name}</ThemedText>.
                </ThemedText>
                <View style={styles.consentDivider} />
                <View style={styles.consentCheckRow}>
                  <View style={styles.checkDot}>
                    <ThemedText type="smallBold" themeColor="accentText">
                      ✓
                    </ThemedText>
                  </View>
                  <ThemedText type="small" themeColor="accentText" style={styles.checkText}>
                    Your answers are never visible to your teammates.
                  </ThemedText>
                </View>
              </View>
            </View>

            <Pressable
              onPress={handleJoin}
              disabled={joining}
              accessibilityRole="button"
              accessibilityState={{ disabled: joining }}
              style={styles.joinButton}
            >
              <ThemedText type="smallBold" themeColor="onAccent">
                {joining ? 'JOINING…' : 'JOIN TEAM'}
              </ThemedText>
            </Pressable>
            <Pressable onPress={() => router.replace('/(tabs)/teams')} accessibilityRole="button" style={styles.notNowButton}>
              <ThemedText type="smallBold" themeColor="textSecondary">
                Not now
              </ThemedText>
            </Pressable>
          </>
        )}
      </SafeAreaView>
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
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      paddingBottom: layout.screenBottom,
    },
    loading: {
      flex: 1,
    },
    notFound: {
      flex: 1,
      alignItems: 'center',
      justifyContent: 'center',
      gap: spacing.sm,
    },
    notFoundBody: {
      textAlign: 'center',
      maxWidth: 280,
    },
    body: {
      flex: 1,
    },
    kicker: {
      letterSpacing: 1.5,
    },
    teamName: {
      marginTop: spacing.md,
    },
    coachedBy: {
      marginTop: spacing.xs,
    },
    consentCard: {
      marginTop: spacing['2xl'],
      padding: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    consentText: {
      lineHeight: 24,
    },
    bold: {
      fontWeight: '800',
    },
    consentDivider: {
      height: 1,
      backgroundColor: colors.border,
      marginTop: spacing.md,
      marginBottom: spacing.md,
    },
    consentCheckRow: {
      flexDirection: 'row',
      alignItems: 'flex-start',
      gap: spacing.sm,
    },
    checkDot: {
      width: 22,
      height: 22,
      borderRadius: radius.full,
      backgroundColor: colors.accentSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    checkText: {
      flex: 1,
    },
    joinButton: {
      minHeight: layout.minTouchTarget,
      paddingVertical: spacing.lg,
      borderRadius: radius.extraLarge,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadowColorAccent,
      shadowOpacity: 1,
      shadowRadius: 16,
      shadowOffset: { width: 0, height: 8 },
      elevation: 8,
    },
    notNowButton: {
      marginTop: spacing.md,
      minHeight: layout.minTouchTarget,
      paddingVertical: spacing.lg,
      alignItems: 'center',
      justifyContent: 'center',
    },
  });
}
