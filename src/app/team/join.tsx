import { router } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

const CODE_LENGTH = 6;

/**
 * Manual join-code entry (plan 4.11, product spec §6.10, screen 15).
 * Submitting a code that resolves navigates to `/join/[code]` — the same
 * consent screen the `tulla://join/[code]` deep link lands on (both paths
 * converge there, per that screen's own doc comment).
 */
export default function JoinTeamScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout });

  const [code, setCode] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const canSubmit = code.trim().length === CODE_LENGTH;

  async function handleContinue() {
    if (!canSubmit || checking) return;
    setChecking(true);
    setError(false);
    try {
      const { data, error: rpcError } = await supabase.rpc('team_lookup_by_join_code', { p_join_code: code.trim() });
      if (rpcError) throw rpcError;
      if (!data || data.length === 0) {
        setError(true);
        return;
      }
      router.push(`/join/${code.trim().toUpperCase()}`);
    } finally {
      setChecking(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <BackButton onPress={() => router.back()} />

        <ThemedText type="title" style={styles.heading}>
          Enter your join code
        </ThemedText>
        <ThemedText type="small" themeColor="textSecondary" style={styles.subheading}>
          Six characters from your coach. Or open the link they sent you.
        </ThemedText>

        <View style={styles.codeRow}>
          {Array.from({ length: CODE_LENGTH }).map((_, i) => {
            // While typing, the next empty box is "active"; once full, the
            // last box stays highlighted (the input still has focus, per the
            // design reference) — there's no next box to point at.
            const active = i === Math.min(code.length, CODE_LENGTH - 1);
            return (
              <View key={i} style={[styles.codeCell, active && styles.codeCellActive]}>
                <ThemedText type="title">{code[i] ?? ''}</ThemedText>
              </View>
            );
          })}
          {/* Real input captures the keyboard, invisibly, over the cells above — the cells are purely display. Standard OTP-input pattern. */}
          <TextInput
            value={code}
            onChangeText={(text) => {
              setCode(text.toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, CODE_LENGTH));
              setError(false);
            }}
            autoFocus
            autoCapitalize="characters"
            autoCorrect={false}
            maxLength={CODE_LENGTH}
            style={styles.hiddenInput}
            accessibilityLabel="Join code"
          />
        </View>

        {error && (
          <View style={styles.errorBox}>
            <ThemedText type="small" style={{ color: colors.status.danger.text }}>
              We can&apos;t find a team with that code. Check it with your coach — codes are six characters, no spaces.
            </ThemedText>
          </View>
        )}

        <Pressable
          onPress={handleContinue}
          disabled={!canSubmit || checking}
          accessibilityRole="button"
          accessibilityState={{ disabled: !canSubmit || checking }}
          style={[styles.continueButton, (!canSubmit || checking) && styles.continueButtonDisabled]}
        >
          <ThemedText type="smallBold" themeColor={canSubmit ? 'onAccent' : 'textDisabled'}>
            {checking ? 'CHECKING…' : 'CONTINUE'}
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
    heading: {
      marginTop: spacing.lg,
    },
    subheading: {
      marginTop: spacing.sm,
      maxWidth: 300,
    },
    codeRow: {
      marginTop: spacing['2xl'],
      flexDirection: 'row',
      gap: spacing.sm,
    },
    codeCell: {
      flex: 1,
      aspectRatio: 0.85,
      borderRadius: radius.medium,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      alignItems: 'center',
      justifyContent: 'center',
    },
    codeCellActive: {
      borderWidth: 1.5,
      borderColor: colors.accent,
    },
    hiddenInput: {
      position: 'absolute',
      top: 0,
      left: 0,
      right: 0,
      bottom: 0,
      opacity: 0,
    },
    errorBox: {
      marginTop: spacing.lg,
      padding: spacing.lg,
      borderRadius: radius.large,
      backgroundColor: colors.status.danger.surface,
      borderWidth: 1,
      borderColor: colors.status.danger.border,
    },
    continueButton: {
      marginTop: spacing.xl,
      minHeight: layout.minTouchTarget,
      paddingVertical: spacing.lg,
      borderRadius: radius.large,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    continueButtonDisabled: {
      backgroundColor: colors.surfaceDisabled,
    },
  });
}
