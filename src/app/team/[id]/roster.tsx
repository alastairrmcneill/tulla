import { useQuery, useQueryClient } from '@tanstack/react-query';
import { router, useLocalSearchParams } from 'expo-router';
import { useState } from 'react';
import { Modal, Pressable, ScrollView, Share, StyleSheet, View } from 'react-native';
import { SafeAreaView } from 'react-native-safe-area-context';

import { BackButton } from '@/components/back-button';
import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { useAuth } from '@/hooks/use-auth';
import { getInitials } from '@/lib/text';
import { supabase } from '@/lib/supabase';
import { useTheme } from '@/theme';

/** Roster / Invite (plan 4.7, product spec §6.8, screen 12). */
export default function RosterScreen() {
  const { colors, spacing, radius, layout } = useTheme();
  const s = getStyles({ colors, spacing, radius, layout });
  const { id } = useLocalSearchParams<{ id: string }>();
  const { user } = useAuth();
  const queryClient = useQueryClient();
  const [actionFor, setActionFor] = useState<{ id: string; name: string | null; role: string } | null>(null);

  const teamQuery = useQuery({
    queryKey: ['teams', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('teams').select('join_code').eq('id', id!).single();
      if (error) throw error;
      return data;
    },
  });

  const membersQuery = useQuery({
    queryKey: ['team_members', 'roster_full', id],
    enabled: !!id,
    queryFn: async () => {
      const { data, error } = await supabase.from('team_members').select('id, profile_id, role, profiles(name)').eq('team_id', id!).order('joined_at', { ascending: true });
      if (error) throw error;
      return data;
    },
  });

  const selfRole = membersQuery.data?.find((m) => m.profile_id === user?.id)?.role;
  const isAdmin = selfRole === 'admin';

  async function handleShare() {
    if (!teamQuery.data) return;
    await Share.share({ message: `Join my team on Tulla — use code ${teamQuery.data.join_code} or open tulla://join/${teamQuery.data.join_code}` });
  }

  async function handlePromote(profileId: string) {
    await supabase.from('team_members').update({ role: 'admin' }).eq('team_id', id!).eq('profile_id', profileId);
    await queryClient.invalidateQueries({ queryKey: ['team_members', 'roster_full', id] });
    setActionFor(null);
  }

  async function handleRemove(profileId: string) {
    await supabase.from('team_members').delete().eq('team_id', id!).eq('profile_id', profileId);
    await queryClient.invalidateQueries({ queryKey: ['team_members', 'roster_full', id] });
    setActionFor(null);
  }

  return (
    <ThemedView style={s.container}>
      <SafeAreaView style={s.safeArea}>
        <ScrollView contentContainerStyle={s.content}>
          <BackButton onPress={() => router.back()} />

          <ThemedText type="title" style={s.heading}>
            Roster
          </ThemedText>

          {isAdmin && teamQuery.data && (
            <View style={s.joinCodeCard}>
              <ThemedText type="smallBold" themeColor="textSecondary" style={s.joinCodeLabel}>
                JOIN CODE
              </ThemedText>
              <ThemedText type="title" themeColor="accentText" style={s.joinCode}>
                {teamQuery.data.join_code}
              </ThemedText>
              <Pressable onPress={handleShare} accessibilityRole="button" style={s.shareButton}>
                <ThemedText type="smallBold" themeColor="onAccent">
                  SHARE INVITE
                </ThemedText>
              </Pressable>
            </View>
          )}

          <ThemedText type="smallBold" themeColor="textTertiary" style={s.sectionLabel}>
            {membersQuery.data?.length ?? 0} MEMBERS
          </ThemedText>

          <View style={s.card}>
            {membersQuery.data?.map((m, i, arr) => (
              <View key={m.id} style={[s.row, i < arr.length - 1 && s.rowDivider]}>
                <View style={s.avatar}>
                  <ThemedText type="small" themeColor="textSecondary">
                    {getInitials(m.profiles?.name)}
                  </ThemedText>
                </View>
                <View style={s.rowBody}>
                  <ThemedText type="default">{m.profiles?.name ?? 'Member'}</ThemedText>
                  <ThemedText type="small" themeColor={m.role === 'admin' ? 'accentText' : 'textSecondary'}>
                    {m.role === 'admin' ? 'Coach' : 'Athlete'}
                  </ThemedText>
                </View>
                {isAdmin && (
                  <Pressable onPress={() => setActionFor({ id: m.profile_id, name: m.profiles?.name ?? null, role: m.role })} accessibilityRole="button" hitSlop={8} style={s.moreButton}>
                    <ThemedText type="default" themeColor="textTertiary">
                      ···
                    </ThemedText>
                  </Pressable>
                )}
              </View>
            ))}
          </View>
        </ScrollView>

        <Modal visible={actionFor !== null} transparent animationType="fade" onRequestClose={() => setActionFor(null)}>
          <Pressable style={s.scrim} onPress={() => setActionFor(null)} accessibilityRole="button" accessibilityLabel="Close" />
          <View style={s.sheet}>
            <ThemedText type="title">{actionFor?.name ?? 'Member'}</ThemedText>
            {actionFor?.role === 'athlete' && (
              <Pressable onPress={() => actionFor && handlePromote(actionFor.id)} accessibilityRole="button" style={s.sheetOption}>
                <ThemedText type="default">Promote to admin</ThemedText>
              </Pressable>
            )}
            <Pressable onPress={() => actionFor && handleRemove(actionFor.id)} accessibilityRole="button" style={s.sheetOption}>
              <ThemedText type="default" style={{ color: colors.status.danger.text }}>
                Remove from team
              </ThemedText>
            </Pressable>
          </View>
        </Modal>
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
      gap: spacing.md,
    },
    heading: { marginTop: spacing.sm },
    joinCodeCard: {
      marginTop: spacing.lg,
      padding: spacing.xl,
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.accentSurface,
      borderWidth: 1,
      borderColor: colors.status.success.border,
      alignItems: 'center',
    },
    joinCodeLabel: { letterSpacing: 1.2 },
    joinCode: { letterSpacing: 6, marginTop: spacing.sm },
    shareButton: {
      marginTop: spacing.md,
      width: '100%',
      minHeight: layout.minTouchTarget,
      borderRadius: radius.large,
      backgroundColor: colors.accent,
      alignItems: 'center',
      justifyContent: 'center',
    },
    sectionLabel: { letterSpacing: 1.2, marginTop: spacing.lg },
    card: {
      borderRadius: radius.extraLarge2,
      backgroundColor: colors.surface,
      borderWidth: 1,
      borderColor: colors.border,
      overflow: 'hidden',
    },
    row: {
      flexDirection: 'row',
      alignItems: 'center',
      gap: spacing.md,
      padding: spacing.md,
    },
    rowDivider: { borderBottomWidth: 1, borderBottomColor: colors.border },
    avatar: {
      width: 36,
      height: 36,
      borderRadius: radius.medium,
      backgroundColor: colors.surfaceElevated,
      alignItems: 'center',
      justifyContent: 'center',
    },
    rowBody: { flex: 1, gap: 2 },
    moreButton: {
      minWidth: layout.minTouchTarget - 12,
      minHeight: layout.minTouchTarget - 12,
      alignItems: 'center',
      justifyContent: 'center',
    },
    scrim: { flex: 1, backgroundColor: colors.scrim },
    sheet: {
      backgroundColor: colors.surfaceElevated,
      borderTopLeftRadius: radius.extraLarge3,
      borderTopRightRadius: radius.extraLarge3,
      padding: spacing.xl,
      gap: spacing.md,
    },
    sheetOption: {
      minHeight: layout.minTouchTarget,
      justifyContent: 'center',
    },
  });
}
