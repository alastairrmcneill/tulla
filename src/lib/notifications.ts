import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { Platform } from 'react-native';

import { supabase } from '@/lib/supabase';

/**
 * Push notification infra (plan 2.3). Fills 1.12's stub.
 *
 * `sendPush()` is a thin wrapper over the `send-push` Edge Function — the
 * `notifications` table has no client insert policy (row_level_security.sql:
 * "notifications are created by triggers/Edge Functions running as
 * service_role"), so the actual insert+push has to run server-side. The real
 * logic lives in `supabase/functions/_shared/send-push.ts`, which 6.10's
 * webhook function calls directly (already server-side, no HTTP hop needed).
 */

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldShowBanner: true,
    shouldShowList: true,
    shouldPlaySound: false,
    shouldSetBadge: false,
  }),
});

/**
 * Requests push permission if not already determined, and on grant
 * registers the Expo push token against the current profile. No-ops on web
 * (no native push there) and if permission was already denied — never
 * re-prompts a user who's said no.
 */
export async function registerForPushNotificationsAsync(): Promise<void> {
  if (Platform.OS === 'web') return;

  if (Platform.OS === 'android') {
    await Notifications.setNotificationChannelAsync('default', {
      name: 'default',
      importance: Notifications.AndroidImportance.DEFAULT,
    });
  }

  const existing = await Notifications.getPermissionsAsync();
  let status = existing.status;
  if (status !== 'granted') {
    const requested = await Notifications.requestPermissionsAsync();
    status = requested.status;
  }
  if (status !== 'granted') return;

  const projectId = Constants.expoConfig?.extra?.eas?.projectId;
  const { data: userData } = await supabase.auth.getUser();
  const userId = userData.user?.id;
  if (!userId) return;

  const { data: pushToken } = await Notifications.getExpoPushTokenAsync(projectId ? { projectId } : undefined);
  await supabase.from('profiles').update({ expo_push_token: pushToken }).eq('id', userId);
}

/**
 * Sends a push (if the profile has a registered token) and always inserts
 * a `notifications` row, so the in-app inbox mirrors every push regardless
 * of permission state (product spec §6.11).
 */
export async function sendPush(profileId: string, title: string, body: string, type?: string): Promise<void> {
  const { error } = await supabase.functions.invoke('send-push', {
    body: { profileId, title, body, type },
  });
  if (error) throw error;
}
