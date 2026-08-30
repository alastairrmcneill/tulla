import { useRouter } from 'expo-router';
import { useState } from 'react';
import { Pressable, StyleSheet, TextInput } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme';

// Mechanism only (plan 1.9) — bare functional form, no onboarding framing.
// 5.6 restyles/re-places this into the onboarding flow's visual context.
export default function SignUpScreen() {
  const { colors, spacing, radius } = useTheme();
  const styles = getStyles(spacing, radius);
  const router = useRouter();
  const { signUpWithPassword, signInWithMagicLink } = useAuth();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [magicLinkSent, setMagicLinkSent] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  async function handleSignUp() {
    setError(null);
    setSubmitting(true);
    try {
      await signUpWithPassword(email, password);
      router.replace('/(tabs)/today');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  async function handleMagicLink() {
    setError(null);
    setSubmitting(true);
    try {
      await signInWithMagicLink(email);
      setMagicLinkSent(true);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Something went wrong.');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ThemedText type="title">Sign Up</ThemedText>

        {magicLinkSent ? (
          <ThemedText type="small" themeColor="textSecondary">
            Check your email for a sign-in link.
          </ThemedText>
        ) : (
          <>
            <TextInput
              value={email}
              onChangeText={setEmail}
              placeholder="Email"
              placeholderTextColor={colors.textSecondary}
              autoCapitalize="none"
              keyboardType="email-address"
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <TextInput
              value={password}
              onChangeText={setPassword}
              placeholder="Password"
              placeholderTextColor={colors.textSecondary}
              secureTextEntry
              style={[styles.input, { color: colors.text, borderColor: colors.border }]}
            />
            <ThemedText type="small" themeColor="textSecondary">
              At least 8 characters, with uppercase, lowercase, and a number.
            </ThemedText>

            {error && (
              <ThemedText type="small" style={{ color: colors.status.danger.text }}>
                {error}
              </ThemedText>
            )}

            <Pressable
              onPress={handleSignUp}
              disabled={submitting || !email || !password}
              style={[styles.button, { backgroundColor: colors.accent }]}>
              <ThemedText type="smallBold" style={{ color: colors.onAccent }}>
                Sign Up
              </ThemedText>
            </Pressable>

            <Pressable onPress={handleMagicLink} disabled={submitting || !email}>
              <ThemedText type="link">Or send me a magic link instead</ThemedText>
            </Pressable>
          </>
        )}

        <Pressable onPress={() => router.push('/(auth)/log-in')}>
          <ThemedText type="link">Already have an account? Log in</ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles(
  spacing: ReturnType<typeof useTheme>['spacing'],
  radius: ReturnType<typeof useTheme>['radius'],
) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
      justifyContent: 'center',
      gap: spacing.lg,
      paddingHorizontal: spacing['2xl'],
    },
    input: {
      borderWidth: StyleSheet.hairlineWidth,
      borderRadius: radius.medium,
      paddingHorizontal: spacing.lg,
      paddingVertical: spacing.md,
    },
    button: {
      alignItems: 'center',
      borderRadius: radius.full,
      paddingVertical: spacing.md,
    },
  });
}
