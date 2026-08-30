import { Redirect } from 'expo-router';
import { useEffect, useState } from 'react';

import { useAuth } from '@/hooks/use-auth';
import { hasCompletedOnboarding } from '@/lib/onboarding';

// Entry route (1.13 scaffolded this as an unconditional onboarding redirect;
// 1.9 wires the real three-way branch): first-ever open goes to onboarding;
// a returning device goes to log-in or straight into the app depending on
// whether a session actually restored. AnimatedSplashOverlay (root
// _layout.tsx) covers the screen for ~600ms on launch, long enough for
// these two local reads to resolve before anything renders underneath.
export default function Index() {
  const { session, loading: authLoading } = useAuth();
  const [onboarded, setOnboarded] = useState<boolean | null>(null);

  useEffect(() => {
    hasCompletedOnboarding().then(setOnboarded);
  }, []);

  if (authLoading || onboarded === null) return null;

  if (!onboarded) return <Redirect href="/(onboarding)/welcome" />;

  return <Redirect href={session ? '/(tabs)/today' : '/(auth)/log-in'} />;
}
