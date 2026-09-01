import { useQuery } from '@tanstack/react-query';

import { useAuth } from '@/hooks/use-auth';
import { supabase } from '@/lib/supabase';
import type { Tables } from '@/types/database';

export type CoachAccess = {
  hasAccess: boolean;
  /** `null` once `subscription_active` — there's no "days left" on a paid subscription. */
  daysRemaining: number | null;
  isTrial: boolean;
};

/**
 * Client-side coach-access UI state (plan 4.2). This is display state only —
 * the real enforcement is the `team_has_access()`/`has_coach_access()` RLS
 * layer (1.7, 4.2's own SQL half), which every coach-read policy already
 * goes through regardless of what this hook renders.
 */
export function useCoachAccess(): CoachAccess & { isLoading: boolean } {
  const { user } = useAuth();

  const query = useQuery({
    queryKey: ['billing_status', user?.id],
    enabled: !!user,
    queryFn: async () => {
      const { data, error } = await supabase.from('billing_status').select('*').eq('profile_id', user!.id).maybeSingle();
      if (error) throw error;
      return data as Tables<'billing_status'> | null;
    },
  });

  return { ...computeCoachAccess(query.data), isLoading: query.isLoading };
}

/** Pure calc, factored out for verification (no test runner in this repo yet — see 3.2's plan note). */
export function computeCoachAccess(billing: Tables<'billing_status'> | null | undefined): CoachAccess {
  if (!billing) return { hasAccess: false, daysRemaining: null, isTrial: false };
  if (billing.subscription_active) return { hasAccess: true, daysRemaining: null, isTrial: false };
  if (!billing.trial_started_at) return { hasAccess: false, daysRemaining: null, isTrial: false };

  // Continuous day count, matching has_coach_access()'s own
  // `trial_started_at > now() - trial_length_days days` comparison exactly —
  // this is UI state that should agree with the RLS truth, not a rounded
  // approximation of it.
  const elapsedDays = (Date.now() - new Date(billing.trial_started_at).getTime()) / (1000 * 60 * 60 * 24);
  const hasAccess = elapsedDays < billing.trial_length_days;
  const daysRemaining = Math.max(0, Math.ceil(billing.trial_length_days - elapsedDays));

  return { hasAccess, daysRemaining, isTrial: true };
}
