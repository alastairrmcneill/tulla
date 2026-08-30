import { ScreenPlaceholder } from '@/components/screen-placeholder';

// Covers product spec §3 steps 2-4 (role branch, athlete/coach-specific
// questions, market-research question) — 5.3's job to build as the actual
// config-driven, branching flow. One placeholder route for now.
export default function QuizScreen() {
  return <ScreenPlaceholder title="Personalization Quiz" />;
}
