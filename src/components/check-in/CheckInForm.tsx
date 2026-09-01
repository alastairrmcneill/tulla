import { useQuery } from '@tanstack/react-query';
import { Fragment, useState } from 'react';
import { Modal, Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import type { Metric } from '@/components/charts/RadarChart';
import { SyncIndicator } from '@/components/sync-indicator';
import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { formatDateKicker, localDateString } from '@/lib/date';
import { enqueue } from '@/lib/offline-queue';
import { queryClient } from '@/lib/query-client';
import { Sentry } from '@/lib/sentry';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import type { Tables } from '@/types/database';

type TeamQuestions = { teamId: string; teamName: string; questions: Tables<'custom_questions'>[] };

/**
 * Custom-question wiring (plan 4.8) — one team's worth of questions per
 * block, only for teams whose admin currently has coach access
 * (`team_has_access()`, 4.2); a locked team's questions simply never appear
 * here, no separate handling needed. Queried per team (not a single joined
 * query) since `team_has_access` is an RPC, not a column to filter on.
 */
function useCustomQuestionsForCheckin(userId: string | undefined) {
  return useQuery({
    queryKey: ['custom_questions', 'for_checkin', userId],
    enabled: !!userId,
    queryFn: async (): Promise<TeamQuestions[]> => {
      const { data: memberships, error: membershipError } = await supabase
        .from('team_members')
        .select('team_id, teams(name)')
        .eq('profile_id', userId!)
        .eq('role', 'athlete');
      if (membershipError) throw membershipError;

      const blocks: TeamQuestions[] = [];
      for (const m of memberships ?? []) {
        const { data: hasAccess } = await supabase.rpc('team_has_access', { p_team_id: m.team_id });
        if (!hasAccess) continue;
        const { data: questions } = await supabase.from('custom_questions').select('*').eq('team_id', m.team_id).order('sort_order', { ascending: true });
        if (questions && questions.length > 0) blocks.push({ teamId: m.team_id, teamName: m.teams?.name ?? 'Your team', questions });
      }
      return blocks;
    },
  });
}

/**
 * Copy verbatim from `design-reference`'s `QUESTIONS` model (product spec
 * §6.1 mandates this for fatigue; the other four follow the same source —
 * already typo-fixed there, so used as-is here).
 */
const QUESTIONS: { metric: Metric; short: string; long: string; responses: [string, string, string, string, string] }[] = [
  { metric: 'fatigue', short: 'FATIGUE', long: 'How fatigued are you feeling today?', responses: ['Always tired', 'More tired than normal', 'Normal', 'Fresh', 'Very fresh'] },
  { metric: 'sleep', short: 'SLEEP', long: 'How was your quality of sleep last night?', responses: ['Insomnia', 'Restless sleep', 'Difficulty falling asleep', 'Good', 'Very restful'] },
  { metric: 'muscle_soreness', short: 'MUSCLES', long: 'How is your general soreness of muscles?', responses: ['Very sore', 'Increased soreness', 'Normal', 'Feeling good', 'Feeling great'] },
  { metric: 'stress', short: 'STRESS', long: 'How stressed are you feeling in general?', responses: ['Highly stressed', 'Feeling stressed', 'Normal', 'Relaxed', 'Very relaxed'] },
  { metric: 'mood', short: 'MOOD', long: 'What is your overall mood level?', responses: ['Highly annoyed, irritable or down', 'Snappiness at teammates or family', 'Less interested than normal', 'A generally good mood', 'Very positive mood'] },
];

const AVAILABILITY_OPTIONS: { value: 1 | 2 | 3; label: string; accessibleLabel: string }[] = [
  { value: 1, label: 'REDUCED', accessibleLabel: 'Reduced availability' },
  { value: 2, label: 'AVAILABLE', accessibleLabel: 'Available' },
  { value: 3, label: 'FULLY', accessibleLabel: 'Fully available' },
];

type Answers = Record<Metric, number>;
const EMPTY_ANSWERS: Answers = { fatigue: 0, sleep: 0, muscle_soreness: 0, stress: 0, mood: 0 };

/** `(avg of the five 1–5 metrics − 1) / 4 × 100` — CODING_PLAN's locked formula (3.4). Exported for verification (no test runner in this repo yet). */
export function computeWellnessScore(answers: Answers): number {
  const values = Object.values(answers);
  const avg = values.reduce((sum, v) => sum + v, 0) / values.length;
  return ((avg - 1) / 4) * 100;
}

export type CheckInFormProps = {
  /** Called when soreness is picked at 1 or 2 — opens 3.6's shared BodyMapSheet, hosted at the Today screen level (not here) so the done-state can reach it too. */
  onLowSoreness: () => void;
};

export function CheckInForm({ onLowSoreness }: CheckInFormProps) {
  const { colors, spacing, radius, layout, opacity } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // layout.tabBarHeight excludes the bottom safe-area inset (its own doc
  // comment) — NativeTabs floats above that inset, so it's added back here.
  const tabBarClearance = layout.tabBarHeight + insets.bottom;

  const [answers, setAnswers] = useState<Answers>(EMPTY_ANSWERS);
  const [availability, setAvailability] = useState<0 | 1 | 2 | 3>(0);
  const [submitting, setSubmitting] = useState(false);
  const [infoFor, setInfoFor] = useState<Metric | null>(null);
  const infoQuestion = QUESTIONS.find((q) => q.metric === infoFor) ?? null;

  const customQuestionsQuery = useCustomQuestionsForCheckin(user?.id);
  const [customAnswers, setCustomAnswers] = useState<Record<string, string>>({});

  const allCustomQuestions = (customQuestionsQuery.data ?? []).flatMap((block) => block.questions);
  const unansweredRequiredCustom = allCustomQuestions.filter((q) => q.required && !customAnswers[q.id]?.trim()).length;
  const unansweredCount = QUESTIONS.filter((q) => answers[q.metric] === 0).length + (availability === 0 ? 1 : 0);
  const canSubmit = unansweredCount === 0 && unansweredRequiredCustom === 0 && !!user;

  function setAnswer(metric: Metric, value: number) {
    const next = answers[metric] === value ? 0 : value;
    setAnswers((prev) => ({ ...prev, [metric]: next }));
    // Trigger is picking a low soreness value itself, not submitting the
    // form (product spec §6.2, refined per the user: a bottom sheet over
    // this same screen, not a separate route push).
    if (metric === 'muscle_soreness' && next > 0 && next <= 2) {
      onLowSoreness();
    }
  }

  async function handleSubmit() {
    if (!canSubmit || !user) return;
    setSubmitting(true);
    try {
      const date = localDateString();
      const payload = {
        profile_id: user.id,
        date,
        fatigue: answers.fatigue,
        sleep: answers.sleep,
        muscle_soreness: answers.muscle_soreness,
        stress: answers.stress,
        mood: answers.mood,
        availability: availability as 1 | 2 | 3,
        wellness_score: computeWellnessScore(answers),
      };

      const queueId = await enqueue('daily_checkin', payload);

      // Optimistic cache write, not invalidate+refetch: this app is
      // offline-first (2.1) — a refetch could still find nothing server-side
      // if we're offline, and the "done for today" state (3.5) has to show
      // regardless of connectivity. `id` is the real offline-queue id (also
      // what actually gets written to the row) so DoneForToday can track
      // this exact submission's sync status, not just "is anything pending".
      queryClient.setQueryData(['daily_checkin', 'today', user.id, date], {
        ...payload,
        id: queueId,
        created_at: new Date().toISOString(),
      });

      // The History tab's own cached window (`['daily_checkins', 'history',
      // user.id, <today>]`) is a *different* query key from the one above —
      // without this, switching to History right after submitting showed
      // stale data, since tabs stay mounted (no fresh mount to trigger a
      // refetch) and nothing was invalidating that cache. Same
      // works-offline reasoning as the write above: a direct merge, not an
      // invalidate+refetch that would need a network round-trip to show
      // anything.
      queryClient.setQueriesData({ queryKey: ['daily_checkins', 'history', user.id], exact: false }, (old: { date: string; wellness_score: number | null }[] | undefined) => {
        if (!old) return old;
        return [...old.filter((r) => r.date !== date), { date, wellness_score: payload.wellness_score }].sort((a, b) => a.date.localeCompare(b.date));
      });

      // Coach-side Team Home reads (completion count, team trend) aren't as
      // time-critical and do need a network round-trip anyway (RLS/consent
      // checks) — a plain invalidate is enough there.
      queryClient.invalidateQueries({ queryKey: ['daily_checkins', 'team_today'] });
      queryClient.invalidateQueries({ queryKey: ['daily_checkins', 'team_trend'] });

      // Custom-question answers are a direct, awaited write (not routed
      // through 2.1's offline queue, which only knows daily_checkin/
      // body_map_entry/rpe_log) — this reuses the queue's own id as the row's
      // real id, so it upserts the same row the queue will otherwise sync
      // later, then attaches the answers to it. Best-effort: a coach's
      // custom question is supplementary, not core wellness data, so an
      // offline failure here silently drops just this part of the submit
      // rather than blocking the check-in itself.
      if (allCustomQuestions.length > 0) {
        try {
          const { error: upsertError } = await supabase.from('daily_checkins').upsert({ ...payload, id: queueId }, { onConflict: 'profile_id,date' });
          if (upsertError) throw upsertError;

          const responses = allCustomQuestions.filter((q) => customAnswers[q.id]?.trim()).map((q) => ({ checkin_id: queueId, custom_question_id: q.id, response_value: customAnswers[q.id] }));
          if (responses.length > 0) {
            const { error: responsesError } = await supabase.from('custom_question_responses').insert(responses);
            if (responsesError) throw responsesError;
          }
        } catch (e) {
          Sentry.captureMessage('custom-question-responses: best-effort write failed', { level: 'warning', extra: { error: e instanceof Error ? e.message : String(e) } });
        }
      }
    } finally {
      setSubmitting(false);
    }
  }

  const styles = getStyles({ colors, spacing, radius, layout, opacity, tabBarClearance });

  return (
    <Fragment>
    <ScrollView contentContainerStyle={styles.container} keyboardShouldPersistTaps="handled">
      <SyncIndicator />
      <ThemedText type="smallBold" themeColor="accentText" style={styles.kicker}>
        {formatDateKicker()}
      </ThemedText>
      <ThemedText type="title" style={styles.heading}>
        How are you feeling?
      </ThemedText>
      <ThemedText type="small" themeColor="textSecondary" style={styles.subheading}>
        Five taps. Tap ⓘ on any row if you want the wording.
      </ThemedText>

      {QUESTIONS.map((q) => {
        const value = answers[q.metric];
        return (
          <View key={q.metric} style={styles.block}>
            <View style={styles.blockHeader}>
              <View style={styles.blockLabelRow}>
                <ThemedText type="smallBold" themeColor="textSecondary" style={styles.blockLabel}>
                  {q.short}
                </ThemedText>
                <Pressable
                  onPress={() => setInfoFor(q.metric)}
                  hitSlop={12}
                  accessibilityRole="button"
                  accessibilityLabel={`${q.long} Full wording for each option.`}
                  style={styles.infoButton}
                >
                  <ThemedText type="smallBold" themeColor="textSecondary" style={styles.infoButtonGlyph}>
                    i
                  </ThemedText>
                </Pressable>
              </View>
              <ThemedText type="smallBold" themeColor="accentText" numberOfLines={1} style={styles.blockAnswer}>
                {value > 0 ? q.responses[value - 1] : ''}
              </ThemedText>
            </View>
            <View style={styles.tileRow}>
              {q.responses.map((response, i) => {
                const optionValue = i + 1;
                const selected = value === optionValue;
                return (
                  <Pressable
                    key={optionValue}
                    onPress={() => setAnswer(q.metric, optionValue)}
                    accessibilityRole="radio"
                    accessibilityState={{ selected }}
                    accessibilityLabel={`${response}, ${optionValue} of 5`}
                    style={[styles.tile, selected && styles.tileSelected]}
                  >
                    <ThemedText type="title" themeColor={selected ? 'onAccent' : 'textTertiary'}>
                      {optionValue}
                    </ThemedText>
                  </Pressable>
                );
              })}
            </View>
          </View>
        );
      })}

      <View style={styles.block}>
        <ThemedText type="smallBold" themeColor="textSecondary" style={styles.blockLabel}>
          AVAILABILITY
        </ThemedText>
        <View style={styles.availabilityRow}>
          {AVAILABILITY_OPTIONS.map((opt) => {
            const selected = availability === opt.value;
            return (
              <Pressable
                key={opt.value}
                onPress={() => setAvailability((prev) => (prev === opt.value ? 0 : opt.value))}
                accessibilityRole="radio"
                accessibilityState={{ selected }}
                accessibilityLabel={opt.accessibleLabel}
                style={[styles.availabilityTile, selected && styles.availabilityTileSelected]}
              >
                <ThemedText type="smallBold" themeColor={selected ? 'accentText' : 'textTertiary'}>
                  {opt.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>
      </View>

      {(customQuestionsQuery.data ?? []).map((block) => (
        <View key={block.teamId} style={styles.block}>
          <View style={styles.customDividerRow}>
            <View style={styles.customDividerLine} />
            <ThemedText type="smallBold" themeColor="accentText" style={styles.customDividerLabel}>
              QUESTIONS FROM {block.teamName.toUpperCase()}
            </ThemedText>
            <View style={styles.customDividerLine} />
          </View>

          <View style={styles.customCard}>
            {block.questions.map((q) => (
              <View key={q.id} style={styles.customQuestionBlock}>
                <View style={styles.blockHeader}>
                  <ThemedText type="smallBold" style={styles.customQuestionText}>
                    {q.question_text}
                  </ThemedText>
                  {!q.required && (
                    <ThemedText type="smallBold" themeColor="textTertiary">
                      OPTIONAL
                    </ThemedText>
                  )}
                </View>

                {q.type === 'scale' ? (
                  <View style={styles.tileRow}>
                    {[1, 2, 3, 4, 5].map((v) => {
                      const selected = customAnswers[q.id] === String(v);
                      return (
                        <Pressable
                          key={v}
                          onPress={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: selected ? '' : String(v) }))}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          style={[styles.tile, selected && styles.tileSelected]}
                        >
                          <ThemedText type="title" themeColor={selected ? 'onAccent' : 'textTertiary'}>
                            {v}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : q.type === 'yes_no' ? (
                  <View style={styles.availabilityRow}>
                    {['Yes', 'No'].map((label) => {
                      const selected = customAnswers[q.id] === label;
                      return (
                        <Pressable
                          key={label}
                          onPress={() => setCustomAnswers((prev) => ({ ...prev, [q.id]: selected ? '' : label }))}
                          accessibilityRole="radio"
                          accessibilityState={{ selected }}
                          style={[styles.availabilityTile, selected && styles.availabilityTileSelected]}
                        >
                          <ThemedText type="smallBold" themeColor={selected ? 'accentText' : 'textTertiary'}>
                            {label}
                          </ThemedText>
                        </Pressable>
                      );
                    })}
                  </View>
                ) : (
                  <TextInput
                    value={customAnswers[q.id] ?? ''}
                    onChangeText={(text) => setCustomAnswers((prev) => ({ ...prev, [q.id]: text }))}
                    placeholder="Type your answer"
                    placeholderTextColor={colors.textTertiary}
                    style={styles.customTextInput}
                    maxLength={280}
                  />
                )}
              </View>
            ))}
          </View>
        </View>
      ))}
      </ScrollView>

      {/* Floating over the scroll content, not part of its flow — matches design-reference exactly (the submit pill sits fixed above the tab bar while the form scrolls underneath it). */}
      <View style={styles.submitBar} pointerEvents="box-none">
        <Pressable
          onPress={handleSubmit}
          disabled={!canSubmit || submitting}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || submitting }}
          style={[styles.submitButton, (!canSubmit || submitting) && styles.submitButtonDisabled]}
        >
          <ThemedText type="smallBold" themeColor={canSubmit ? 'onAccent' : 'textDisabled'}>
            {submitting ? 'SUBMITTING…' : canSubmit ? 'SUBMIT CHECK-IN' : `${unansweredCount} TO GO`}
          </ThemedText>
        </Pressable>
      </View>

      <Modal visible={infoQuestion !== null} transparent animationType="slide" onRequestClose={() => setInfoFor(null)}>
        <Pressable style={styles.scrim} onPress={() => setInfoFor(null)} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={styles.sheet}>
          <ThemedText type="title">{infoQuestion?.long}</ThemedText>
          <View style={styles.sheetOptions}>
            {infoQuestion?.responses.map((response, i) => {
              const optionValue = i + 1;
              const selected = infoQuestion && answers[infoQuestion.metric] === optionValue;
              return (
                <Pressable
                  key={optionValue}
                  onPress={() => {
                    setAnswer(infoQuestion.metric, optionValue);
                    setInfoFor(null);
                  }}
                  accessibilityRole="radio"
                  accessibilityState={{ selected: !!selected }}
                  style={[styles.sheetOption, selected && styles.sheetOptionSelected]}
                >
                  <ThemedText type="smallBold" themeColor={selected ? 'onAccent' : 'text'}>
                    {optionValue}
                  </ThemedText>
                  <ThemedText themeColor={selected ? 'onAccent' : 'text'} style={styles.sheetOptionText}>
                    {response}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>
      </Modal>
    </Fragment>
  );
}

function getStyles({
  colors,
  spacing,
  radius,
  layout,
  opacity,
  tabBarClearance,
}: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout' | 'opacity'> & { tabBarClearance: number }) {
  return StyleSheet.create({
    container: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      // Clears the floating tab bar AND the floating submit bar above it —
      // neither reserves its own layout space (NativeTabs, 1.13; submitBar
      // below), so this screen accounts for both itself.
      paddingBottom: layout.screenBottom + tabBarClearance + layout.minTouchTarget + spacing.lg,
      gap: spacing['2xl'],
    },
    kicker: {
      letterSpacing: 1.4,
      marginBottom: -spacing.lg,
    },
    heading: {
      marginBottom: spacing.xs,
    },
    subheading: {},
    customDividerRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
    },
    customDividerLine: {
      flex: 1,
      height: 1,
      backgroundColor: colors.status.success.border,
    },
    customDividerLabel: {
      letterSpacing: 1.2,
    },
    customCard: {
      marginTop: spacing.md,
      padding: spacing.lg,
      borderRadius: radius.extraLarge,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.status.success.border,
      gap: spacing.lg,
    },
    customQuestionBlock: {
      gap: spacing.md,
    },
    customQuestionText: {
      flex: 1,
    },
    customTextInput: {
      minHeight: layout.minTouchTarget,
      borderRadius: radius.medium,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      paddingHorizontal: spacing.lg,
      color: colors.text,
    },
    block: {
      gap: spacing.md,
    },
    blockHeader: {
      flexDirection: 'row',
      alignItems: 'baseline',
      justifyContent: 'space-between',
      gap: spacing.sm,
    },
    blockLabelRow: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.xs,
    },
    blockLabel: {
      letterSpacing: 1.2,
    },
    infoButton: {
      width: 20,
      height: 20,
      borderRadius: radius.full,
      borderWidth: 1.5,
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    infoButtonGlyph: {
      fontStyle: 'italic',
    },
    blockAnswer: {
      flex: 1,
      textAlign: 'right',
    },
    tileRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    tile: {
      flex: 1,
      aspectRatio: 1,
      minHeight: layout.minTouchTarget,
      borderRadius: radius.large,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    tileSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
      shadowColor: colors.shadowColorAccent,
      shadowOpacity: 1,
      shadowRadius: 10,
      shadowOffset: { width: 0, height: 4 },
      elevation: 6,
    },
    availabilityRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    availabilityTile: {
      flex: 1,
      minHeight: layout.minTouchTarget,
      paddingVertical: spacing.lg,
      borderRadius: radius.large,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    availabilityTileSelected: {
      backgroundColor: colors.accentSurface,
      borderColor: colors.accent,
      borderWidth: 1.5,
    },
    submitBar: {
      position: 'absolute',
      left: 0,
      right: 0,
      bottom: tabBarClearance + spacing.lg,
      paddingHorizontal: layout.screenHorizontal,
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
    },
    submitButton: {
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
      opacity: opacity.disabled,
    },
    scrim: {
      flex: 1,
      backgroundColor: colors.scrim,
    },
    sheet: {
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: radius.extraLarge3,
      borderTopRightRadius: radius.extraLarge3,
      padding: spacing.xl,
      gap: spacing.lg,
    },
    sheetOptions: {
      gap: spacing.sm,
    },
    sheetOption: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      minHeight: layout.minTouchTarget,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.medium,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
    },
    sheetOptionSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    sheetOptionText: {
      flex: 1,
    },
  });
}
