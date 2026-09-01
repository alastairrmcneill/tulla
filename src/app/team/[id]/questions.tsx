import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';
import type { Tables } from '@/types/database';

type QuestionType = Tables<'custom_questions'>['type'];
type Draft = { id: string | null; question_text: string; type: QuestionType; required: boolean };

const TYPE_LABELS: { value: QuestionType; label: string }[] = [
  { value: 'scale', label: '1–5 SCALE' },
  { value: 'yes_no', label: 'YES / NO' },
  { value: 'text', label: 'TEXT' },
];

/**
 * Custom Questions setup (plan 4.8, product spec §6.9, screen 13). Up to 2
 * questions per team — the trigger from 1.6 enforces this server-side; this
 * screen just surfaces that error clearly rather than a silent failure.
 * Saving invalidates every `['custom_questions', …]` query (prefix match),
 * which is what makes 4.8's check-in wiring (`CheckInForm`) pick the change
 * up live.
 */
export default function CustomQuestionsScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const s = getStyles({ colors, spacing, radius, layout });
  const { id } = useLocalSearchParams<{ id: string }>();
  const queryClient = useQueryClient();

  const [drafts, setDrafts] = useState<Draft[]>([]);
  const [loadedIds, setLoadedIds] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const query = useQuery({
    queryKey: ['custom_questions', 'setup', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error: fetchError } = await supabase.from('custom_questions').select('*').eq('team_id', id!).order('sort_order', { ascending: true });
      if (fetchError) throw fetchError;
      return data;
    },
  });

  // Seed local drafts from the server once per fresh load — after that, the
  // form is the source of truth until Save. A legitimate one-time
  // hydration-from-async-data case, not derivable at render time (same
  // pattern/justification as use-auth.ts's profile reset).
  useEffect(() => {
    if (query.data && loadedIds.length === 0 && query.data.length > 0) {
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setDrafts(query.data.map((q) => ({ id: q.id, question_text: q.question_text, type: q.type as QuestionType, required: q.required })));
      setLoadedIds(query.data.map((q) => q.id));
    }
  }, [query.data, loadedIds.length]);

  function addQuestion() {
    if (drafts.length >= 2) return;
    setDrafts((prev) => [...prev, { id: null, question_text: '', type: 'scale', required: false }]);
  }

  function updateDraft(index: number, patch: Partial<Draft>) {
    setDrafts((prev) => prev.map((d, i) => (i === index ? { ...d, ...patch } : d)));
  }

  function removeDraft(index: number) {
    setDrafts((prev) => prev.filter((_, i) => i !== index));
  }

  async function handleSave() {
    if (!id || saving) return;
    setSaving(true);
    setError(null);
    try {
      const currentIds = drafts.map((d) => d.id).filter((v): v is string => v !== null);
      const toDelete = loadedIds.filter((existingId) => !currentIds.includes(existingId));

      for (const draftId of toDelete) {
        const { error: deleteError } = await supabase.from('custom_questions').delete().eq('id', draftId);
        if (deleteError) throw deleteError;
      }

      for (let i = 0; i < drafts.length; i++) {
        const draft = drafts[i]!;
        if (!draft.question_text.trim()) continue;
        if (draft.id) {
          const { error: updateError } = await supabase
            .from('custom_questions')
            .update({ question_text: draft.question_text.trim(), type: draft.type, required: draft.required, sort_order: i })
            .eq('id', draft.id);
          if (updateError) throw updateError;
        } else {
          const { error: insertError } = await supabase
            .from('custom_questions')
            .insert({ team_id: id, question_text: draft.question_text.trim(), type: draft.type, required: draft.required, sort_order: i });
          if (insertError) throw insertError;
        }
      }

      await queryClient.invalidateQueries({ queryKey: ['custom_questions'] });
      router.back();
    } catch (e) {
      // The 1.6 trigger's exception ("A team can have at most 2 custom
      // questions") surfaces here verbatim rather than a generic failure.
      setError(e instanceof Error ? e.message : 'Something went wrong saving your questions.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <ThemedView style={s.container}>
      <SafeAreaView style={s.safeArea}>
        <ScrollView contentContainerStyle={s.content}>
          <BackButton onPress={() => router.back()} />

          <ThemedText type="title" style={s.heading}>
            Your questions
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={s.subheading}>
            Up to two. They appear at the end of every athlete&apos;s check-in, under their own divider.
          </ThemedText>

          {drafts.map((draft, i) => (
            <View key={draft.id ?? `new-${i}`} style={s.card}>
              <View style={s.cardHeaderRow}>
                <ThemedText type="smallBold" themeColor="textTertiary" style={s.cardLabel}>
                  QUESTION {i + 1}
                </ThemedText>
                <Pressable onPress={() => removeDraft(i)} accessibilityRole="button" hitSlop={8}>
                  <ThemedText type="small" style={{ color: colors.status.danger.text }}>
                    Remove
                  </ThemedText>
                </Pressable>
              </View>

              <TextInput
                value={draft.question_text}
                onChangeText={(text) => updateDraft(i, { question_text: text })}
                placeholder="e.g. Hydration since last session"
                placeholderTextColor={colors.textTertiary}
                style={s.input}
                maxLength={100}
              />

              <View style={s.chipRow}>
                {TYPE_LABELS.map((t) => {
                  const selected = draft.type === t.value;
                  return (
                    <Pressable key={t.value} onPress={() => updateDraft(i, { type: t.value })} accessibilityRole="button" accessibilityState={{ selected }} style={[s.chip, selected && s.chipSelected]}>
                      <ThemedText type="small" themeColor={selected ? 'onAccent' : 'textSecondary'}>
                        {t.label}
                      </ThemedText>
                    </Pressable>
                  );
                })}
              </View>

              <Pressable onPress={() => updateDraft(i, { required: !draft.required })} accessibilityRole="switch" accessibilityState={{ checked: draft.required }} style={s.requiredRow}>
                <ThemedText type="default" style={s.requiredLabel}>
                  Required
                </ThemedText>
                <View style={[s.toggleTrack, draft.required && s.toggleTrackOn]}>
                  <View style={[s.toggleThumb, draft.required && s.toggleThumbOn]} />
                </View>
              </Pressable>
            </View>
          ))}

          {drafts.length < 2 && (
            <Pressable onPress={addQuestion} accessibilityRole="button" style={s.addButton}>
              <ThemedText type="default" themeColor="textSecondary">
                + Add question {drafts.length + 1}
              </ThemedText>
            </Pressable>
          )}

          {error && (
            <ThemedText type="small" style={{ color: colors.status.danger.text }}>
              {error}
            </ThemedText>
          )}

          <Pressable onPress={handleSave} disabled={saving} accessibilityRole="button" style={[s.saveButton, saving && s.saveButtonDisabled]}>
            <ThemedText type="smallBold" themeColor="onAccent">
              {saving ? 'SAVING…' : 'SAVE'}
            </ThemedText>
          </Pressable>
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
      gap: spacing.lg,
    },
    heading: { marginTop: spacing.sm },
    subheading: { maxWidth: 305 },
    card: {
      padding: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      gap: spacing.md,
    },
    cardHeaderRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'center',
    },
    cardLabel: { letterSpacing: 1 },
    input: {
      fontSize: 17,
      fontWeight: '600',
      color: colors.text,
      minHeight: layout.minTouchTarget,
      padding: 0,
    },
    chipRow: {
      flexDirection: 'row',
      gap: spacing.sm,
    },
    chip: {
      paddingHorizontal: spacing.md,
      paddingVertical: spacing.sm,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
    },
    chipSelected: {
      backgroundColor: colors.accent,
      borderColor: colors.accent,
    },
    requiredRow: {
      flexDirection: 'row',
      alignItems: 'center',
      paddingTop: spacing.md,
      borderTopWidth: 1,
      borderTopColor: colors.border,
    },
    requiredLabel: { flex: 1 },
    toggleTrack: {
      width: 46,
      height: 27,
      borderRadius: radius.full,
      backgroundColor: colors.surfaceElevated,
      justifyContent: 'center',
      padding: 2,
    },
    toggleTrackOn: {
      backgroundColor: colors.accent,
    },
    toggleThumb: {
      width: 23,
      height: 23,
      borderRadius: radius.full,
      backgroundColor: '#fff',
    },
    toggleThumbOn: {
      alignSelf: 'flex-end',
    },
    addButton: {
      minHeight: layout.minTouchTarget,
      borderRadius: radius.large,
      borderWidth: 1,
      borderStyle: 'dashed',
      borderColor: colors.borderStrong,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButton: {
      minHeight: layout.minTouchTarget,
      borderRadius: radius.extraLarge,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      opacity: 0.6,
    },
  });
}
