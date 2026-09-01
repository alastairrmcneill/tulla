import { router, useLocalSearchParams } from 'expo-router';
import { ScrollView, StyleSheet } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { AthleteDetailView } from '@/components/team/AthleteDetailView';
import { ThemedView } from '@/components/themed-view';
import { useTheme } from '@/theme';

/** Full-screen phone route for 4.6's Athlete Detail — the tablet split-view's right pane renders the same `<AthleteDetailView>` directly from `team/[id]/index.tsx`, no back button needed there. */
export default function AthleteDetailScreen() {
  const { layout, spacing } = useTheme();
  const styles = getStyles({ layout, spacing });
  const { id, athleteId } = useLocalSearchParams<{ id: string; athleteId: string }>();

  return (
    <ThemedView style={styles.container}>
      <SafeAreaView style={styles.safeArea}>
        <ScrollView contentContainerStyle={styles.content}>
          <BackButton onPress={() => router.back()} />
          {id && athleteId && <AthleteDetailView teamId={id} athleteId={athleteId} />}
        </ScrollView>
      </SafeAreaView>
    </ThemedView>
  );
}

function getStyles({ layout, spacing }: Pick<ReturnType<typeof useTheme>, 'layout' | 'spacing'>) {
  return StyleSheet.create({
    container: {
      flex: 1,
    },
    safeArea: {
      flex: 1,
    },
    content: {
      width: '100%',
      maxWidth: layout.maxContentWidth,
      alignSelf: 'center',
      paddingHorizontal: layout.screenHorizontal,
      paddingTop: layout.screenTop,
      paddingBottom: layout.screenBottom,
      gap: spacing.md,
    },
  });
}
