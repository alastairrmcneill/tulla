import type { Session } from '@supabase/supabase-js';
import { useCallback, useEffect, useState } from 'react';

import { markOnboardingComplete } from '@/lib/onboarding';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

type Profile = Tables<'profiles'>;

/**
 * Auth flow mechanism (plan 1.9) — this is the plumbing, not the
 * onboarding-framed sign-up screen (5.6 restyles/re-places this into that
 * flow later). Session persistence across restarts comes for free from
 * 1.12's AsyncStorage-backed client, not anything this hook does itself.
 */
export function useAuth() {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) markOnboardingComplete();
    });

    return () => subscription.unsubscribe();
  }, []);

  useEffect(() => {
    const userId = session?.user.id;
    if (!userId) {
      // Clearing stale profile state from a previous session on sign-out —
      // a legitimate reset-on-dependency-change, not a synchronization bug.
      // eslint-disable-next-line react-hooks/set-state-in-effect
      setProfile(null);
      return;
    }

    let cancelled = false;
    supabase
      .from('profiles')
      .select('*')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        if (!cancelled) setProfile(data);
      });

    return () => {
      cancelled = true;
    };
  }, [session?.user.id]);

  const signUpWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signInWithPassword = useCallback(async (email: string, password: string) => {
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signInWithMagicLink = useCallback(async (email: string) => {
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: 'tulla://auth/callback' },
    });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
  }, []);

  return {
    session,
    user: session?.user ?? null,
    profile,
    loading,
    signUpWithPassword,
    signInWithPassword,
    signInWithMagicLink,
    signOut,
  };
}
