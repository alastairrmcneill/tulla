// send-push Edge Function (plan 2.3). Client entry point for
// `lib/notifications.ts`'s `sendPush()` — the actual insert+push logic
// lives in `_shared/send-push.ts` since it has to run with service-role DB
// access (the notifications table has no client insert policy by design).
//
// Requires a valid JWT (verify_jwt: true at deploy) — any signed-in user can
// currently push to any profileId, since this ticket ships infra only.
// Per-relationship authorization (coach -> own team's athletes) belongs to
// whichever ticket builds the actual "send reminder" UI (4.5), not here.
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

import { sendPushNotification } from '../_shared/send-push.ts';

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
};

Deno.serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }
  if (req.method !== 'POST') {
    return new Response('Method not allowed', { status: 405, headers: corsHeaders });
  }

  let payload: { profileId?: string; title?: string; body?: string; type?: string };
  try {
    payload = await req.json();
  } catch {
    return new Response('Invalid JSON body', { status: 400, headers: corsHeaders });
  }

  const { profileId, title, body, type } = payload;
  if (!profileId || !title || !body) {
    return new Response('profileId, title, and body are required', { status: 400, headers: corsHeaders });
  }

  const supabaseAdmin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!);

  try {
    await sendPushNotification(supabaseAdmin, profileId, title, body, type);
    return new Response(JSON.stringify({ ok: true }), {
      status: 200,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  } catch (error) {
    console.error('send-push failed', error);
    return new Response(JSON.stringify({ ok: false, error: String(error) }), {
      status: 500,
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    });
  }
});
