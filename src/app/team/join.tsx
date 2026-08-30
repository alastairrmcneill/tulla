import { ScreenPlaceholder } from '@/components/screen-placeholder';

// Manual join-code entry (screen 15). Submitting navigates to
// /join/[code], which is the same consent screen the tulla://join/[code]
// deep link lands on (3.9 — both paths converge there).
export default function JoinTeamScreen() {
  return <ScreenPlaceholder title="Join Team" />;
}
