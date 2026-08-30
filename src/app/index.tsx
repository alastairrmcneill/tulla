import { Redirect } from 'expo-router';

// Placeholder entry route (1.13) — always sends a fresh launch into
// onboarding. Real session/onboarding-complete branching (skip straight to
// (tabs) for a returning signed-in user) is 1.9's job once auth exists.
export default function Index() {
  return <Redirect href="/(onboarding)/welcome" />;
}
