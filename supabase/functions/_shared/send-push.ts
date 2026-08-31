// Core send-push logic (plan 2.3). Deployed as part of both the send-push
// Edge Function (client-invoked, below) and, later, the on-checkin-flag-check
// webhook function (6.10) — which the plan describes as calling "2.3's
// sendPush()" directly from its own already-service-role context, with no
// extra network hop needed.
import type { SupabaseClient } from 'https://esm.sh/@supabase/supabase-js@2';

const EXPO_PUSH_API = 'https://exp.host/--/api/v2/push/send';

export async function sendPushNotification(
  supabaseAdmin: SupabaseClient,
  profileId: string,
  title: string,
  body: string,
  type: string = 'general',
): Promise<void> {
  // Inbox always mirrors what was pushed, regardless of permission state
  // (product spec §6.11) — insert first, independent of whether a token
  // exists or the Expo call below succeeds.
  const { error: insertError } = await supabaseAdmin.from('notifications').insert({
    profile_id: profileId,
    type,
    title,
    body,
  });
  if (insertError) throw insertError;

  const { data: profile, error: profileError } = await supabaseAdmin
    .from('profiles')
    .select('expo_push_token')
    .eq('id', profileId)
    .single();
  if (profileError) throw profileError;

  const token = profile?.expo_push_token as string | null;
  if (!token) return; // No permission grant yet — the inbox row is still there.

  const response = await fetch(EXPO_PUSH_API, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
    body: JSON.stringify([{ to: token, title, body }]),
  });
  if (!response.ok) {
    throw new Error(`Expo push API responded ${response.status}`);
  }

  // Expo's push API returns HTTP 200 even when a specific token fails to
  // deliver (invalid credentials, DeviceNotRegistered, etc.) — the real
  // per-token result is a "ticket" in the response body, not the status
  // code. Skipping this check means delivery failures go silently
  // unnoticed while the caller sees success.
  const result = (await response.json()) as { data?: Array<{ status: string; message?: string; details?: unknown }> };
  const ticket = result.data?.[0];
  if (ticket?.status === 'error') {
    throw new Error(`Expo push ticket error: ${ticket.message ?? 'unknown'} (${JSON.stringify(ticket.details)})`);
  }
}
