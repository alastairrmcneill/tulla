import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

import { ThemedText } from '@/components/themed-text';
import { ScreenPlaceholder } from '@/components/screen-placeholder';
import { useAuth } from '@/hooks/use-auth';
import { useTheme } from '@/theme';

// Log out is 1.9's own done-when, not 5.12's (which builds the full Settings
// screen this button will live in properly). Bare-minimum control on the
// placeholder until then.
export default function SettingsScreen() {
  const { colors, spacing } = useTheme();
  const styles = getStyles(spacing);
  const router = useRouter();
  const { signOut } = useAuth();

  async function handleLogOut() {
    await signOut();
    router.replace('/(auth)/log-in');
  }

  return (
    <ScreenPlaceholder title="Settings">
      <Pressable onPress={handleLogOut} style={[styles.button, { backgroundColor: colors.surfaceElevated }]}>
        <ThemedText type="smallBold">Log out</ThemedText>
      </Pressable>
    </ScreenPlaceholder>
  );
}

function getStyles(spacing: ReturnType<typeof useTheme>['spacing']) {
  return StyleSheet.create({
    button: {
      alignItems: 'center',
      paddingVertical: spacing.md,
      paddingHorizontal: spacing['2xl'],
      borderRadius: 999,
    },
  });
}
