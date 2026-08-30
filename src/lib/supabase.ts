// Must be the first import in this file. Hermes doesn't provide a
// spec-compliant `URL`/`URLSearchParams`, which supabase-js's internals rely
// on -- missing this causes silent failures deep in the SDK (confirmed: with
// this missing, session persistence never actually wrote to storage, with no
// error surfaced anywhere). Required per Supabase's own React Native
// quickstart, which 1.12 missed.
import 'react-native-url-polyfill/auto';

import AsyncStorage from '@react-native-async-storage/async-storage';
import { createClient } from '@supabase/supabase-js';

import type { Database } from '@/types/database';

/**
 * Client singleton (plan 1.12). Typed against the generated schema so a
 * query on any of 1.6's tables comes back with real column types, not `any`.
 *
 * `AsyncStorage` gives the client a persistent session adapter — 1.9 is
 * where this actually gets exercised (session-restore-on-relaunch), but the
 * client has to be configured with it from day one rather than falling back
 * to the in-memory default.
 */
export const supabase = createClient<Database>(
  process.env.EXPO_PUBLIC_SUPABASE_URL!,
  process.env.EXPO_PUBLIC_SUPABASE_ANON_KEY!,
  {
    auth: {
      storage: AsyncStorage,
      autoRefreshToken: true,
      persistSession: true,
      detectSessionInUrl: false,
    },
  },
);
