import * as Crypto from 'expo-crypto';
import * as SecureStore from 'expo-secure-store';
import { Mixpanel } from 'mixpanel-react-native';

/**
 * Analytics (plan 1.11) — infra only here. The full funnel event set (tech
 * plan §7 / product spec §9) gets wired per-flow as those flows are built;
 * 5.7 is where it all comes together.
 *
 * Anonymous identify happens on first open, before any auth exists, so the
 * pre-signup funnel (onboarding_started, role_selected, ...) attributes to
 * the same person once they do sign up. `alias()` is meant to be called
 * once, right after a successful sign-up, to join the anon id to the real
 * Supabase user id — that call belongs in 1.9's auth flow, which doesn't
 * exist yet (still blocked on 1.13). Deferred, not forgotten.
 */

const ANON_ID_KEY = 'mixpanel_anon_id';

let mixpanel: Mixpanel | null = null;

async function getOrCreateAnonId(): Promise<string> {
  const existing = await SecureStore.getItemAsync(ANON_ID_KEY);
  if (existing) return existing;

  const anonId = Crypto.randomUUID();
  await SecureStore.setItemAsync(ANON_ID_KEY, anonId);
  return anonId;
}

export async function initMixpanel() {
  const token = process.env.EXPO_PUBLIC_MIXPANEL_TOKEN;
  if (!token) return;

  const instance = new Mixpanel(token, true);
  // This project has EU data residency (its dashboard is on eu.mixpanel.com)
  // — the SDK defaults to the US ingestion host, which silently drops every
  // event for an EU-hosted project instead of erroring. Confirmed by
  // querying: without this, even Mixpanel's own automatic $session_start
  // event landed in Lexicon's schema list but with zero actual event data.
  await instance.init(undefined, undefined, 'https://api-eu.mixpanel.com');

  // Lets every downstream query/dashboard split real usage from
  // development noise (user's explicit ask for this task).
  instance.registerSuperProperties({
    environment: __DEV__ ? 'development' : 'production',
  });

  const anonId = await getOrCreateAnonId();
  await instance.identify(anonId);

  mixpanel = instance;
}

export function getMixpanel(): Mixpanel | null {
  return mixpanel;
}
