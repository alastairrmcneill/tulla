# History — Tulla

Completed epics, kept for the record. Not read each session — `CODING_PLAN.md` and the current epic file under `plan/` are the active documents.

---

## Epic 0 — Design System & Theme Foundation

### 0.1 — Design tokens (spacing, radius, typography, motion) `[x]`

`src/theme/tokens.ts` — 4pt spacing scale, Material-3-shape-scale radius (`none…full`), Material-3-type-scale typography (`display/headline/title/body/label` × `Large/Medium/Small`, plus `overline`/`mono`), motion (`duration`/`easing`), `layout` constants (tab bar height, hairline, max content width). Committed `a56b723`.

### 0.2 — Colour tokens (dark + light) and `ThemeProvider` `[x]`

`src/theme/colors.ts` (`dark`/`light`, semantic roles: `background`/`surface`/`text`/`accent`/`status.{danger,warning,success}`/`glass.{tabBar,sheet}` with flat fallback colours for Reduce Transparency and Android). `src/theme/theme-context.tsx` — `ThemeProvider` + `useTheme()`, seeds `dark` regardless of OS setting. Committed `a56b723`.

### 0.3 — Native appearance sync (`Appearance.setColorScheme`) `[x]`

`theme-context.tsx` calls `Appearance.setColorScheme(mode)` at module load and in a `useLayoutEffect` keyed on `mode`, so `NativeTabs` (real SwiftUI, reads OS trait collection directly) tracks app theme instead of device Settings. Committed `a56b723`.

---

## Epic 1 — Foundation

### 1.1 — GitHub repo `[x]`
Private repo, `main` pushed with full history, branch protection deferred until 1.14's CI check exists.

### 1.2 — App identity & config `[x]`
`app.json`: `ios.bundleIdentifier` / `android.package` = `com.alastairrmcneill.tulla`, `scheme: "tulla"` confirmed.

### 1.3 — EAS project + build profiles `[x]`
`eas.json` with `development`/`preview`/`production` profiles; `expo-dev-client` confirmed installed.

### 1.4 — Liquid Glass smoke test `[x]`
`expo-glass-effect` confirmed rendering on iOS 26 dev build; Reduce Transparency fallback confirmed. Throwaway surface removed.

### 1.5 — Supabase project `[x]`
Fresh project created via Supabase MCP, CLI linked, `supabase/migrations/` ready.

### 1.6 — Core schema migration `[x]`
`profiles`, `billing_status` (incl. `trial_length_days`), `teams`, `team_members`, `custom_questions`, `daily_checkins`, `custom_question_responses`, `body_map_entries`, `rpe_logs`, `notifications` — 10 tables, indexes on `daily_checkins(profile_id,date)`, `team_members(team_id,profile_id)`, `rpe_logs(profile_id,logged_at)`.

### 1.7 — Row-Level Security `[x]`
RLS enabled on all 10 tables. `has_coach_access(p_profile_id)` function. `billing_status`: select-only for owner, no authenticated write policy. Coach-gated select via `team_members` join on `daily_checkins`, `body_map_entries`, `rpe_logs`, `custom_questions`, `custom_question_responses`. Tested both allowed and denied reads per table.

### 1.8 — Supabase Auth configuration `[x]`
Email/password + magic link enabled, social off. Email templates styled. Redirect URL `tulla://`. Deep link routing confirmed for `tulla://auth/callback`.

### 1.9 — Auth flow in-app `[x]`
`hooks/useAuth.ts`, sign-up/log-in screens under `(auth)/`, trigger creates `profiles` row on `auth.users` insert, session persistence confirmed across restarts. Note: these are the plain/standalone auth screens — the onboarding-framed presentation of sign-up is built fresh in Epic 6 (6.6), not a restyle pass over these.

### 1.10 — Sentry `[x]`
Project created, `@sentry/react-native` wired, source maps via EAS Build hooks, test error confirmed via Sentry MCP.

### 1.11 — Mixpanel `[x]`
Project created, SDK wired, anon identify via `expo-secure-store` UUID, `alias()` wired into 1.9's sign-up path, confirmed via Mixpanel MCP.

### 1.12 — Client library scaffolding `[x]`
`lib/supabase.ts` typed via generated `types/database.ts`. `lib/revenuecat.ts`/`lib/notifications.ts` stubbed pending Epics 5/2.

### 1.13 — Navigation scaffold `[x]`
Route groups per tech plan §2, placeholder screens for the full 20-screen inventory, real 4-tab `(tabs)` structure on `NativeTabs`.

### 1.14 — CI pipeline `[x]`
`.github/workflows/ci.yml` — `npm ci`, `tsc --noEmit`, `npm run lint` on every PR. `eslint.config.js` committed ahead of wiring CI.

---

## Epic 2 — Shared Data & Notification Infrastructure

### 2.1 — Offline-first write queue `[x]`
`lib/offline-queue.ts`: `enqueue(kind, payload)`, one `AsyncStorage` key per item (client-generated UUID, `@tulla/offline-queue/` prefix), local write commits before any network attempt. Background sync on enqueue, `NetInfo` reconnect, and app open. 3 attempts, 2s/10s/60s backoff (in-memory per sync cycle, not persisted — a fresh cycle starts on next app open/reconnect); final failure logs to Sentry, item stays queued. Upserts on `id` (client-generated) even for the two append-only kinds, so a retry after a lost-ack success can't duplicate a row; `daily_checkins` upserts on `profile_id,date` (its real unique constraint) for correct same-day last-write-wins. `useSyncStatus()` + `<SyncIndicator/>`. `@react-native-community/netinfo` added.

### 2.2 — Shared data-fetching hook `[x]`
`lib/query-client.ts`: `QueryClient` (`retry: 2`, `gcTime` 24h) + `AsyncStorage` persister (`maxAge` 24h), wraps app root in `<PersistQueryClientProvider>`. `<RetryBanner/>`: renders only when a query is erroring with no cached data; stays hidden on stale-but-cached renders. `@tanstack/react-query` + persist-client + async-storage-persister added. Binding rule for every later read screen: `useQuery` against this client, not a raw `useEffect` + fetch.

### 2.3 — Push notification infra + in-app inbox `[x]`
`profiles.expo_push_token` column added. `notifications` has no client insert policy by design (service-role only), so the real `sendPush()` logic lives server-side: `supabase/functions/_shared/send-push.ts` (insert notifications row unconditionally, call Expo's push API if a token exists, check the per-ticket status in the response body — Expo returns HTTP 200 even on a per-token delivery failure) deployed as the `send-push` Edge Function (`verify_jwt: true`; known gap — authorizes on "signed in", not on any relationship to the target profile, left for 4.5's actual UI to close). `lib/notifications.ts` (fills 1.12's stub): `registerForPushNotificationsAsync()` + `sendPush()` as a thin `functions.invoke()` wrapper. Real inbox screen at `app/notifications.tsx` (screen 19): `useQuery` list via 2.2, mark-read on open, `<RetryBanner/>`. `expo-notifications` added + `app.json` plugin entry. Device-verified end to end on a physical iOS device, including generating APNs push credentials via `eas credentials` (a local build never provisions these; only EAS Build does) — a first local build without them produced a confirmed `InvalidCredentials` failure, silently reported as success until the per-ticket-status check above was added.

---

## Epic 3 — Athlete Core (always-free)

The free, no-team-required side of the product. Product spec §1: individual tracking is free forever — nothing here gates behind `has_coach_access()`.

### 3.1 — Personal baseline computation `[x]`
`rolling_baseline(p_profile_id, p_metric, p_window_days, p_min_coverage, p_as_of)` — lagged window (excludes the day being compared), `sd` floored at 0.5, `mean`/`sd` null when `coverage < p_min_coverage`. `athlete_baseline_14`/`athlete_baseline_28` wrap it as set-returning (one row per metric) so a single RPC call feeds both the radar chart and the coach flagged-list. `security invoker`, not `definer` — reads `daily_checkins` as the calling role so existing RLS applies unchanged, no auth logic duplicated. Verified against seeded fixtures: 20-day window sufficient with correct mean/sd, <10-day window insufficient with null mean/sd, 14 identical values floor `sd` at 0.5 not 0.

### 3.2 — Radar chart component `[x]`
`components/charts/RadarChart.tsx` — geometry lifted from `design-reference`'s `onPreview` radar SVG (200×200 viewBox, r=72, 72° steps from 12 o'clock). Two overlaid polygons: dashed neutral baseline vs. solid accent current — dash as well as colour, so the pair isn't colour-only. Insufficient-baseline axis plots its baseline vertex at the current-value point instead of a misleading zero. Plain numeric props, no query coupling. SVG hidden from the accessibility tree; a parallel screen-reader-only row carries the real per-axis VoiceOver/TalkBack summary. `react-native-svg` added.

### 3.3 — Body map SVG component `[x]`
`components/charts/BodyMap.tsx` — front/back toggle, coarse silhouette from primitive SVG shapes (no real body-map artwork exists in `design-reference` — confirmed with the user, geometric placeholder swappable later). 9 front / 7 back tappable regions matching the locked region list; standard anatomical-chart mirroring (front mirrors L/R, back doesn't), same `location` id shared across views for arm/leg. Tap opens a severity sheet (mild/moderate/severe + optional note, confirm disabled until severity picked), writes via 2.1's offline queue (`body_map_entry` kind). Plain shared `Modal`-based sheet, no Liquid Glass/Material 3 fork — deferred to Epic 7's polish sweep. Accessible per-region `Rect`/`Circle` (`accessibilityRole="button"` + label). `lib/date.ts`'s `localDateString()` added alongside it (local, not UTC, calendar day — a queued item stamps the date it was captured, not synced).

### 3.4 — Daily check-in screen (Today tab) `[x]`
`components/check-in/CheckInForm.tsx` — verbatim `QUESTIONS` copy from `design-reference` (fatigue/sleep/muscles/stress/mood), 5-wide numeral-tile scale, availability as plain text buttons (no icons — matches `design-reference` exactly, confirmed with the user over an initial smiley-icon build). Submit disabled until all 5 + availability answered. `wellness_score = (avg−1)/4×100`. Writes via `enqueue('daily_checkin', ...)` then an **optimistic** cache write (not invalidate+refetch) so the done-state shows immediately even fully offline. ⓘ info button per row (design fidelity, confirmed with the user): opens a sheet with the full question + all 5 worded responses, each tappable. Picking soreness 1 or 2 opens 3.3's `BodyMap` in a bottom sheet immediately (revised mid-ticket, confirmed with the user, from product spec §6.2's literal "show the body map screen" — a same-screen sheet instead of a route push, so the athlete never leaves the check-in flow; 3.6's manual entry point reuses the same sheet). `<SyncIndicator/>` dropped in per 2.1's binding rule. Live-tested end to end on iOS Simulator, including a real submit and DB write; caught and fixed a missing `ScrollView` during that pass (form wasn't reachable past STRESS on a real device).

### 3.5 — "Done for today" state `[x]`
`components/check-in/DoneForToday.tsx` — "TODAY VS BASELINE" card housing 3.2's `RadarChart` (current values from the fetched `daily_checkins` row, baseline via a new `athlete_baseline_14` RPC query), "See your history" button. Layout/copy match `design-reference`'s `isDone` block; skipped its computed "N areas below usual" summary line (demo logic uses a raw ≤2 threshold, not a real baseline/z-score comparison, and no threshold is locked anywhere in the plan) and its "Restart check-in (demo)" link (dev-only). Verified live: real submitted check-in renders the actual chart with correct per-axis values, baseline correctly collapsed to current (insufficient data).

### 3.6 — Body map screen wiring `[x]`
`components/check-in/BodyMapSheet.tsx` — extracted the sheet out of `CheckInForm` into a shared component hosted once at the Today screen level (`today/index.tsx`), since the manual "Something hurts? Mark it on the body map" link has to be reachable regardless of check-in state (product spec §6.2) — including the done-state, which `CheckInForm` doesn't render. Both the automatic (3.4, soreness ≤2) and manual paths land on the same sheet → `BodyMap` (3.3), so they write `body_map_entries` identically by construction. Verified live: link renders above the done-state.

### 3.7 — Log a Session (RPE) `[x]`
`components/session/LogSessionFab.tsx` — persistent "+ LOG SESSION" floating button, plain styled per this ticket's own spec (Liquid Glass deferred to 7.1). Sheet copy verbatim from `design-reference`: "How hard did that session feel?", 1–10 tap grid, optional note, save disabled until a value is picked. Writes via `enqueue('rpe_log', ...)` with a real `logged_at` timestamp. Wired onto Today and onto History via `ScreenPlaceholder`'s `children` escape hatch (History itself was still 3.8's placeholder at the time). DB-verified: multiple same-day `rpe_logs` rows are distinct (fresh id per `enqueue()` call, no business-key unique constraint on that table, unlike `daily_checkins`).

### 3.8 — History screen `[x]`
Line chart (`react-native-gifted-charts`): trend line is the trailing-14-day average *including* today (3.1's display-smoothing calc, deliberately distinct from `athlete_baseline_14`), 30 daily points. Baseline reference is a single flat dashed line, not a per-day series — reuses one `athlete_baseline_14` call (as-of today) folded into one 0–100 number via the `wellness_score` formula, matching `design-reference`'s own flat-dashed-line baseline treatment; hidden entirely unless every metric's baseline is sufficient. Calendar (`react-native-calendars`): daily `wellness_score` bucketed into the app's 3 existing status roles (danger/warning/success) — no threshold is locked anywhere in the plan, so this avoids inventing a 4th shade — every cell also carries a glyph (▼/–/▲) and a full `accessibilityLabel`, never colour alone. Load-trend: rolling 7-day RPE sums (not calendar weeks, matching 3.1's lagged-window convention), >10% swing for an arrow. Empty state gates on zero `daily_checkins` in the fetch window. Added `expo-linear-gradient`: `react-native-gifted-charts`' `LineChart` imports a gradient package unconditionally at module load regardless of whether gradient props are used — missing it crashed the whole app bundle on launch, not just the chart; caught live on the iOS Simulator. All 4 pure calc functions verified against fixtures.

---

## Epic 4 — Teams & Coaching

The paid product surface. Trial-gating (4.1/4.2) landed before anything that displays gated state, so Team Home never needed a stubbed banner. Built and reviewed as one pass across all 11 tickets rather than ticket-by-ticket, with a device-testing round at the end (per the user's call for this epic specifically) that surfaced several real UI bugs beyond the original spec — those fixes are folded into the relevant ticket below rather than listed separately.

### 4.1 — Trial start trigger `[x]`
`private.start_trial_for_creator()`, `after insert on teams` — inserts `billing_status` only if the creator has no row yet (second/later team never resets or extends a trial), `trial_length_days` resolved server-side via `hashtext(created_by) % 2` (50/50, never client-supplied). `constants/experiments.ts` mirrors `{control: 7, variant_b: 5}` for display only. Verified live against the real dev project: both variants reachable, second team for the same creator left the existing row untouched.

### 4.2 — `useCoachAccess()` hook + `team_has_access()` `[x]`
`team_has_access(p_team_id)` — `bool_or` of `has_coach_access()` across a team's admins (handles 4.7's later multi-admin promotion), deliberately `public` (unlike `is_team_member`/`is_team_admin`/`has_coach_access`, which 1.7 moved to `private` specifically to kill their RPC surface) since 4.8/4.10 call it directly from the client; advisor-flagged as callable by `anon` on first deploy, fixed with an explicit `revoke ... from anon`. `hooks/use-coach-access.ts` — `computeCoachAccess()` pure calc factored out, continuous day-math matching `has_coach_access()`'s own comparison exactly rather than a rounded approximation. Verified against fixture rows (mid-trial/expired/subscribed) and against `team_has_access()` for active vs. expired admins.

### 4.3 — Create Team screen `[x]`
`team/create.tsx`. Caught live: the id can't be read back via `.select().single()` after insert — `teams_select_member` (RLS) only allows a *member* to select a team, and the creator isn't one yet at that instant (the `team_members` insert is the next statement) — fixed by generating the id client-side (`expo-crypto`) instead. Sport chips (Hockey/Football/Rugby/Netball/Running + "Other" free-text) and copy matched to the design-reference screenshots directly, including a "TRIAL ACTIVE · N DAYS" pill shown only when this profile already has a running trial/subscription from another team.

### 4.4 — Flagged-list computation `[x]`
`team_flagged_athletes(p_team_id)` — independent `pain_reported`/`below_baseline`/`rising_load` per athlete, priority-bucket-then-magnitude sort, `security invoker` so a caller without `has_coach_access()` or without a given athlete's consent simply sees no rows for that athlete from the underlying RLS-protected tables (no auth logic re-derived here). Extended mid-epic with `pain_location` (design fidelity — the flagged-list chip reads "Left leg pain", not the severity word). Verified live with a seeded fixture team: correct reasons/ordering, zero rows for an expired-trial admin and for a non-admin caller.

### 4.5 — Team Home screen (phone + tablet) `[x]`
`app/team/[id]/index.tsx`. All 5 required sections, plus a "Squad Signals" per-metric panel (sparkline + 14-day delta + today's value, tone-coloured) added after the fact to match design-reference screenshots the user provided — beyond this ticket's literal 5-section scope but requested directly. Custom collapsing header (kicker+title → compact bar on scroll, plain `Animated` API) built in-component rather than via expo-router's native `Stack` header, which pulled in iOS's own translucent/glass material — not this app's chrome. Tablet split-view (flagged list left ~35%, `AthleteDetailView` right ~65%) per product spec §4. Fixed post-build: a `content` container `maxWidth` override was letting the trend chart and squad-signals rows render wider than the phone screen (`LineChart`'s `yAxisLabelWidth` also turned out to render *outside* its `width` prop rather than inside it — fixed by measuring the card via `onLayout` and reserving that space explicitly, plus a `overflow:'hidden'` backstop on the card itself).

### 4.6 — Athlete Detail screen `[x]`
`components/team/AthleteDetailView.tsx` — one component, used both as `team/[id]/athlete/[athleteId].tsx`'s full-screen phone route and as 4.5's tablet right-pane, per the ticket's own "same component, different container" requirement.

### 4.7 — Roster / Invite screen `[x]`
`team/[id]/roster.tsx` — join-code display + native `Share.share()`, promote/remove per member. The admin-only `team_members` update/delete RLS this ticket calls for was already added pre-emptively in 1.7 — confirmed by reading the migration, not re-added.

### 4.8 — Custom Questions setup + check-in wiring `[x]`
`team/[id]/questions.tsx` (up to 2 questions, live preview, trigger's max-2 error surfaced verbatim) and `CheckInForm.tsx` wiring: queries each team-membership's `team_has_access()` and renders that team's questions under their own "Questions from [Team]" divider. Answers are a direct, awaited write (not routed through 2.1's offline queue, which only knows 3 kinds) reusing the queue's own id — best-effort, since a coach's custom question is supplementary, not core wellness data.

### 4.9 — All Responses screen `[x]`
`team/[id]/responses.tsx` — raw per-athlete table (5 metrics), newest-first, same RLS as every other coach-side read.

### 4.10 — Team Info screen (athlete, read-only) `[x]`
Athlete branch of `team/[id]/index.tsx` — locked-team notice, exact spec copy, gated on `team_has_access()`.

### 4.11 — Join Team + Consent flow `[x]`
`team/join.tsx` (6-cell code entry, real OTP-style boxes — not one styled `TextInput` — matching design-reference exactly) and `join/[code].tsx` (consent screen, both the manual-code and `tulla://join/[code]` deep-link paths converge here). New RPC `team_lookup_by_join_code`, not in this ticket's literal text: `teams_select_member` (RLS) blocks a non-member from reading a team's name/coach before joining at all, so a narrow `security definer` lookup (team name/sport/coach name only, never the join code back) was required for the flow to function. The RLS consent-gate this ticket calls for was already added pre-emptively in 1.7 (confirmed by reading the migration) — no new migration needed for that half.

### Untracked but required: Teams tab list screen
Product spec §4 / screen 7 was never given its own ticket anywhere in the plan, but every other 4.x screen is unreachable without it (it's the only entry point to Create/Join and to any existing team). Built as `app/(tabs)/teams/index.tsx` — flagged to the user as a plan gap rather than silently added.

### Also fixed during this epic
- **Trial-start paywall** (product spec §3 step 8 / §4): tapping "+ Create a team" with no `billing_status` row yet now goes through `team/paywall.tsx` first (generic copy, no onboarding-quiz context) before `team/create.tsx` — this was missing from the initial pass. Distinct from `(onboarding)/paywall.tsx` (epic 6, personalized headline).
- **History tab showing stale data after a same-session check-in**: `CheckInForm`'s optimistic cache write only ever touched the Today-tab query key; History reads a different key and tabs stay mounted (no remount to trigger a refetch). Submit now also merges directly into History's cached window (same offline-safe pattern as the Today write) and invalidates the Team Home read keys.
- **Shared `BackButton`** (`components/back-button.tsx`): every team-flow screen's ad hoc "‹ Label" text link replaced with one component (same tap target, same press-dim feedback) for consistency with Team Home's collapsing-header chevron.
- Toast feedback on Team Home's "Remind" button (`sendPush()` gave no visible confirmation otherwise) and press feedback on the button itself.
