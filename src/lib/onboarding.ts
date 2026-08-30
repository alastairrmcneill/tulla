import AsyncStorage from '@react-native-async-storage/async-storage';

/**
 * Device-local flag distinguishing "first-ever open" from "returning user"
 * (1.9, per product discussion) — separate from the auth session itself, so
 * a logged-out returning user lands on log-in, not back through onboarding.
 *
 * Onboarding itself isn't built yet (Epic 5), so for now this is set the
 * moment any session is established (sign-up or log-in) — currently the
 * only real "past onboarding" event that exists. Once 5.1-5.7 land, the
 * real onboarding flow should set this explicitly at its end instead.
 */
const HAS_COMPLETED_ONBOARDING_KEY = 'has_completed_onboarding';

export async function hasCompletedOnboarding(): Promise<boolean> {
  return (await AsyncStorage.getItem(HAS_COMPLETED_ONBOARDING_KEY)) === 'true';
}

export async function markOnboardingComplete(): Promise<void> {
  await AsyncStorage.setItem(HAS_COMPLETED_ONBOARDING_KEY, 'true');
}
