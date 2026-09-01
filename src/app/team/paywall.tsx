import { router } from 'expo-router';
import { Pressable, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/theme';

const BULLETS = [
  "Flagged list every morning — who dipped, who reported pain, who's ramping load",
  'Up to two of your own questions on every check-in',
  "One-tap reminders for anyone who hasn't logged",
  'Per-question squad breakdowns — see fatigue or soreness drifting before anyone complains',
  'One subscription covers every team you coach',
  'Your athletes keep personal tracking free, forever',
];

/**
 * Trial-start pitch (product spec §3 step 8 / §4 / §7, screen 8) — shown the
 * first time an existing user taps "+ Create a team" with no `billing_status`
 * row yet ("someone with no active trial or subscription" per §4). Distinct
 * from `(onboarding)/paywall.tsx` (epic 6, ticket 6.7): that one's headline
 * is personalized from the onboarding quiz's "biggest challenge" answer;
 * reached this way there's no quiz context, so the copy here is generic.
 * Doesn't purchase or start anything itself — the trial actually starts
 * server-side (4.1) the moment `team/create.tsx`'s insert lands.
 */
export default function TeamPaywallScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const styles = getStyles({ colors, spacing, radius, layout });

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <View style={styles.topRow}>
          <Pressable onPress={() => router.back()} accessibilityRole="button" hitSlop={8}>
            <ThemedText type="small" themeColor="textSecondary">
              Not now
            </ThemedText>
          </Pressable>
        </View>

        <View style={styles.body}>
          <ThemedText type="smallBold" themeColor="accentText" style={styles.kicker}>
            COACHING A TEAM
          </ThemedText>
          <ThemedText type="title" style={styles.headline}>
            See who needs you, every morning
          </ThemedText>
          <ThemedText type="small" themeColor="textSecondary" style={styles.sub}>
            The team view turns twelve check-ins into one clear list, sorted by who needs attention today.
          </ThemedText>

          <View style={styles.bulletList}>
            {BULLETS.map((text) => (
              <View key={text} style={styles.bulletRow}>
                <View style={styles.bulletDot}>
                  <ThemedText type="smallBold" themeColor="accentText">
                    ✓
                  </ThemedText>
                </View>
                <ThemedText type="default" style={styles.bulletText}>
                  {text}
                </ThemedText>
              </View>
            ))}
          </View>
        </View>

        <View style={styles.priceCard}>
          <View style={styles.priceRow}>
            <ThemedText type="default" style={styles.priceHeadline}>
              7 days free
            </ThemedText>
            <ThemedText type="small" themeColor="textSecondary">
              then £8/month
            </ThemedText>
          </View>
          <ThemedText type="small" themeColor="textSecondary" style={styles.priceNote}>
            No card now. We&apos;ll ask when your trial ends — nothing happens automatically.
          </ThemedText>
        </View>

        <Pressable onPress={() => router.push('/team/create')} accessibilityRole="button" style={styles.ctaButton}>
          <ThemedText type="smallBold" themeColor="onAccent">
            START YOUR FREE 7-DAY TRIAL
          </ThemedText>
        </Pressable>
        <Pressable onPress={() => router.back()} accessibilityRole="button" style={styles.skipButton}>
          <ThemedText type="small" themeColor="textTertiary">
            Just track myself for now — always free
          </ThemedText>
        </Pressable>
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles({ colors, spacing, radius, layout }: Pick<ReturnType<typeof useTheme>, 'colors' | 'spacing' | 'radius' | 'layout'>) {
  return StyleSheet.create({
    container: { flex: 1 },
    safeArea: {
      flex: 1,
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      paddingBottom: layout.screenBottom,
    },
    topRow: {
      flexDirection: 'row',
      justifyContent: 'flex-end',
    },
    body: {
      flex: 1,
      paddingTop: spacing.xl,
    },
    kicker: { letterSpacing: 1.5 },
    headline: { marginTop: spacing.md },
    sub: { marginTop: spacing.md, maxWidth: 310 },
    bulletList: { marginTop: spacing['2xl'], gap: spacing.md },
    bulletRow: { flexDirection: 'row', alignItems: 'flex-start', gap: spacing.md },
    bulletDot: {
      width: 22,
      height: 22,
      borderRadius: radius.full,
      backgroundColor: colors.accentSurface,
      alignItems: 'center',
      justifyContent: 'center',
    },
    bulletText: { flex: 1 },
    priceCard: {
      padding: spacing.lg,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      marginBottom: spacing.md,
    },
    priceRow: {
      flexDirection: 'row',
      justifyContent: 'space-between',
      alignItems: 'baseline',
    },
    priceHeadline: { fontWeight: '700' },
    priceNote: { marginTop: spacing.xs },
    ctaButton: {
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
    skipButton: {
      marginTop: spacing.md,
      alignItems: 'center',
      minHeight: layout.minTouchTarget,
      justifyContent: 'center',
    },
  });
}
