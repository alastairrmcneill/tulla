import { useState } from 'react';
import { Modal, Pressable, StyleSheet, TextInput, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { useAuth } from '@/hooks/use-auth';
import { enqueue } from '@/lib/offline-queue';
import { useTheme } from '@/theme';

const RPE_VALUES = Array.from({ length: 10 }, (_, i) => i + 1);

/**
 * Log a Session / RPE (plan 3.7, product spec §6.3) — persistent on Today
 * and History, always available (no session-calendar gating). iOS: plain
 * styled button here, upgraded to Liquid Glass in 7.1 per this ticket's own
 * spec — don't fork a .ios.tsx for this yet.
 */
export function LogSessionFab() {
  const { colors, spacing, radius, layout, opacity } = useTheme();
  const { user } = useAuth();
  const insets = useSafeAreaInsets();
  // layout.tabBarHeight is explicitly "excluding the bottom safe-area inset"
  // (its own doc comment) — NativeTabs floats above that inset, so it has to
  // be added back in here, not baked into the static token.
  const tabBarClearance = layout.tabBarHeight + insets.bottom;
  const styles = getStyles({ colors, spacing, radius, layout, opacity, tabBarClearance });

  const [open, setOpen] = useState(false);
  const [rpeValue, setRpeValue] = useState(0);
  const [note, setNote] = useState('');
  const [submitting, setSubmitting] = useState(false);

  function close() {
    setOpen(false);
    setRpeValue(0);
    setNote('');
  }

  async function handleSave() {
    if (!rpeValue || !user || submitting) return;
    setSubmitting(true);
    try {
      await enqueue('rpe_log', {
        profile_id: user.id,
        logged_at: new Date().toISOString(),
        rpe_value: rpeValue,
        note: note.trim() || null,
      });
      close();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <>
      <Pressable onPress={() => setOpen(true)} accessibilityRole="button" accessibilityLabel="Log a session" style={styles.fab}>
        <ThemedText type="smallBold" themeColor="accentText">
          + LOG SESSION
        </ThemedText>
      </Pressable>

      <Modal visible={open} transparent animationType="slide" onRequestClose={close}>
        <Pressable style={styles.scrim} onPress={close} accessibilityLabel="Close" accessibilityRole="button" />
        <View style={styles.sheet}>
          <ThemedText type="title">How hard did that session feel?</ThemedText>
          <ThemedText type="small" themeColor="textSecondary">
            1 is a stroll. 10 is everything you had.
          </ThemedText>

          <View style={styles.grid}>
            {RPE_VALUES.map((v) => {
              const selected = rpeValue === v;
              return (
                <Pressable
                  key={v}
                  onPress={() => setRpeValue((prev) => (prev === v ? 0 : v))}
                  accessibilityRole="radio"
                  accessibilityState={{ selected }}
                  accessibilityLabel={`${v} of 10`}
                  style={[styles.tile, selected && styles.tileSelected]}
                >
                  <ThemedText type="title" themeColor={selected ? 'onAccent' : 'textTertiary'}>
                    {v}
                  </ThemedText>
                </Pressable>
              );
            })}
          </View>

          <TextInput
            value={note}
            onChangeText={setNote}
            placeholder="What was the session? (optional)"
            placeholderTextColor={colors.textTertiary}
            style={styles.noteInput}
            maxLength={140}
          />

          <Pressable
            onPress={handleSave}
            disabled={!rpeValue || submitting}
            accessibilityRole="button"
            accessibilityState={{ disabled: !rpeValue || submitting }}
            style={[styles.saveButton, (!rpeValue || submitting) && styles.saveButtonDisabled]}
          >
            <ThemedText type="smallBold" themeColor={rpeValue ? 'onAccent' : 'textDisabled'}>
              {submitting ? 'SAVING…' : rpeValue ? 'SAVE SESSION' : 'PICK A NUMBER'}
            </ThemedText>
          </Pressable>
        </View>
      </Modal>
    </>
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
    fab: {
      position: 'absolute',
      right: spacing.lg,
      bottom: tabBarClearance + spacing.lg,
      height: 48,
      paddingHorizontal: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surfaceElevated,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
      shadowColor: colors.shadowColor,
      shadowOpacity: 0.5,
      shadowRadius: 12,
      shadowOffset: { width: 0, height: 6 },
      elevation: 6,
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
      paddingBottom: spacing.xl + tabBarClearance,
      gap: spacing.md,
    },
    grid: {
      flexDirection: 'row',
      flexWrap: 'wrap',
      gap: spacing.sm,
    },
    tile: {
      // 5-wide grid: 100/5 minus proportional gap share, so 5 fit per row exactly.
      width: '18%',
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
    },
    noteInput: {
      color: colors.text,
      backgroundColor: colors.surface,
      borderRadius: radius.medium,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
      minHeight: layout.minTouchTarget,
    },
    saveButton: {
      minHeight: layout.minTouchTarget,
      paddingVertical: spacing.lg,
      borderRadius: radius.extraLarge,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    saveButtonDisabled: {
      backgroundColor: colors.surfaceDisabled,
      opacity: opacity.disabled,
    },
  });
}
