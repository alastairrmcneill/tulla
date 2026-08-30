import { ScreenPlaceholder } from '@/components/screen-placeholder';

// Consent screen (screen 16) — reached via the tulla://join/[code] deep
// link and via team/join.tsx's manual code entry; both converge here (3.9).
export default function JoinConsentScreen() {
  return <ScreenPlaceholder title="Join Team — Consent" />;
}
