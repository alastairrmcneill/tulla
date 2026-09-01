import * as Crypto from 'expo-crypto';
import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useCoachAccess } from '@/hooks/use-coach-access';
import { generateJoinCode } from '@/lib/team';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Common sports offered as one-tap chips (product spec §6.5: "sport tag (optional)"), plus "Other" for free text — same pattern as the onboarding quiz's sport question (product spec §3). Not an enum in the schema — `teams.sport` is free text, this is just a fast path. */
const SPORT_CHIPS = ['Hockey', 'Football', 'Rugby', 'Netball', 'Running'];

const UNIQUE_VIOLATION = '23505';
const JOIN_CODE_MAX_ATTEMPTS = 5;

/**
 * Create Team screen (plan 4.3, product spec §6.5, screen 9). Trial start is
 * entirely 4.1's server-side trigger's job — this screen makes no
 * trial-related call of its own, just the plain `teams`/`team_members` insert.
 */
export default function CreateTeamScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout });
  const { user } = useAuth();
  const coachAccess = useCoachAccess();

  const [name, setName] = useState('');
  const [sport, setSport] = useState<string | null>(null);
  const [customSport, setCustomSport] = useState('');
  const [showCustomSport, setShowCustomSport] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const resolvedSport = showCustomSport ? customSport.trim() || null : sport;

  const canSubmit = name.trim().length > 0 && !!user;

  async function handleSubmit() {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    setError(null);
    try {
      // The id is generated here, not read back from the insert's
      // `returning` clause: `teams_select_member` (RLS) only allows a
      // *member* to select a team's row, and the creator isn't a member yet
      // at the moment of this insert — the team_members row is the very next
      // statement. Reading the id back would hit that policy and fail with
      // "0 rows returned" despite the insert itself having succeeded.
      let teamId: string | null = null;
      for (let attempt = 0; attempt < JOIN_CODE_MAX_ATTEMPTS && !teamId; attempt++) {
        const candidateId = Crypto.randomUUID();
        const { error: insertError } = await supabase
          .from('teams')
          .insert({ id: candidateId, name: name.trim(), sport: resolvedSport, created_by: user.id, join_code: generateJoinCode() });

        if (!insertError) {
          teamId = candidateId;
          break;
        }
        // A join_code collision (vanishingly unlikely at 33^6, but not
        // impossible) is the only error worth retrying on — anything else
        // surfaces to the user immediately.
        if (insertError.code !== UNIQUE_VIOLATION) throw insertError;
      }

      if (!teamId) throw new Error("Couldn't generate a unique join code — please try again.");

      const { error: memberError } = await supabase.from('team_members').insert({ team_id: teamId, profile_id: user.id, role: 'admin' });
      if (memberError) throw memberError;

      router.replace(`/team/${teamId}`);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong creating the team.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        {/* Only shown when this profile already has a running trial/subscription
            from another team — first-ever team creation goes through
            team/paywall.tsx first instead, so there's nothing to badge yet. */}
        {(coachAccess.isTrial || coachAccess.hasAccess) && (
          <View style={styles.trialPill}>
            <ThemedText type="smallBold" themeColor="accentText">
              {coachAccess.isTrial ? `TRIAL ACTIVE · ${coachAccess.daysRemaining} DAY${coachAccess.daysRemaining === 1 ? '' : 'S'}` : 'SUBSCRIBED'}
            </ThemedText>
          </View>
        )}

        <ThemedText type="title" style={styles.heading}>
          Name your team
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subheading}>
          Athletes will see this when they join. You can change it later.
        </ThemedText>

        <View style={styles.field}>
          <ThemedText type="smallBold" themeColor="accentText" style={styles.fieldLabel}>
            TEAM NAME
          </ThemedText>
          <TextInput
            value={name}
            onChangeText={setName}
            placeholder="e.g. Riverside FC"
            placeholderTextColor={colors.textTertiary}
            style={styles.input}
            maxLength={60}
            autoFocus
          />
        </View>

        <ThemedText type="smallBold" themeColor="textTertiary" style={styles.sportLabel}>
          SPORT (OPTIONAL)
        </ThemedText>
        <View style={styles.chipRow}>
          {SPORT_CHIPS.map((label) => {
            const selected = !showCustomSport && sport === label;
            return (
              <Pressable
                key={label}
                onPress={() => {
                  setShowCustomSport(false);
                  setSport(selected ? null : label);
                }}
                accessibilityRole="button"
                accessibilityState={{ selected }}
                style={[styles.chip, selected && styles.chipSelected]}
              >
                <ThemedText type="smallBold" themeColor={selected ? 'onAccent' : 'text'}>
                  {label}
                </ThemedText>
              </Pressable>
            );
          })}
          <Pressable
            onPress={() => {
              setSport(null);
              setShowCustomSport((prev) => !prev);
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: showCustomSport }}
            style={[styles.chip, showCustomSport && styles.chipSelected]}
          >
            <ThemedText type="smallBold" themeColor={showCustomSport ? 'onAccent' : 'text'}>
              Other
            </ThemedText>
          </Pressable>
        </View>

        {showCustomSport && (
          <TextInput
            value={customSport}
            onChangeText={setCustomSport}
            placeholder="Type your sport"
            placeholderTextColor={colors.textTertiary}
            style={styles.customSportInput}
            maxLength={40}
            autoFocus
          />
        )}

        {error && (
          <ThemedText type="small" themeColor="text" style={[styles.error, { color: colors.status.danger.text }]}>
            {error}
          </ThemedText>
        )}

        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || submitting }}
          style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
        >
          <ThemedText type="smallBold" themeColor={canSubmit ? 'onAccent' : 'textDisabled'}>
            {submitting ? 'CREATING…' : 'CREATE TEAM'}
          </ThemedText>
        </Pressable>
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
    trialPill: {
      alignSelf: 'flex-start',
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.xs,
      borderRadius: radius.full,
      backgroundColor: colors.accentSurface,
    },
    heading: {
      marginTop: spacing.lg,
    },
    subheading: {
      marginTop: spacing.sm,
      maxWidth: 300,
    },
    field: {
      marginTop: spacing['2xl'],
      padding: spacing.lg,
      borderRadius: radius.large,
      backgroundColor: colors.surface,
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    fieldLabel: {
      letterSpacing: 1,
    },
    input: {
      marginTop: spacing.xs,
      fontSize: 19,
      fontWeight: '600',
      color: colors.text,
      minHeight: layout.minTouchTarget,
      padding: 0,
    },
    sportLabel: {
      letterSpacing: 1,
      marginTop: spacing['2xl'],
      marginBottom: spacing.sm,
    },
    chipRow: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.sm,
      minHeight: layout.minTouchTarget - 12,
      justifyContent: 'center',
      // Rounded rectangle, not a full pill — matches the design reference's
      // sport chips (distinct from the "TRIAL ACTIVE" badge above, which
      // does stay pill-shaped).
      borderRadius: radius.medium,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    customSportInput: {
      marginTop: spacing.sm,
      minHeight: layout.minTouchTarget,
      borderRadius: radius.medium,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      color: colors.text,
    },
    error: {
      marginTop: spacing.lg,
    },
    submitButton: {
      marginTop: spacing['2xl'],
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
    submitButtonDisabled: {
      backgroundColor: colors.surfaceDisabled,
    },
  });
}
