import { ScreenPlaceholder } from '@/components/screen-placeholder';

// Serves both screen 10 (Team Home, coach/admin) and screen 14 (Team Info,
// read-only athlete view) — same route, role-conditional rendering (3.3/
// 3.8), not two separate URLs. Tablet split-view also lives here (3.3).
export default function TeamHomeScreen() {
  return <ScreenPlaceholder title="Team Home" />;
}
