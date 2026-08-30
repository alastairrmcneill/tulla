# Coding Plan — Tulla

**Status:** living document — this is the plan, the history, and the backlog in one file.
**Depends on:** `01-product-spec.md` (what) and `02-technical-implementation-plan.md` (how) — every task below cites the section(s) of those two documents it implements. Read this file first each session (per `CLAUDE.md`), then only the spec sections a task actually cites.

## How this document works

- Work is grouped into **epics** (`1.`, `2.`, …), each epic broken into **tasks** (`1.1`, `1.2`, …). A task is one commit/PR-sized chunk — implement it, stop, show the diff, wait for approval, commit, tick the box, move to the next task. Never batch multiple tasks into one commit and never jump ahead to a later task without finishing or explicitly deferring the current one (`CLAUDE.md` workflow rules 2–5).
- Status markers: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked/deferred (reason noted inline).
- Each task template: **Depends on** (other tasks that must land first) · **References** (spec/tech-plan sections, design-reference state-flags) · **Implementation** (the actual detail) · **Done when** (acceptance criteria).
- "Design-reference state-flag" refers to the `sc-if value="{{ onX }}"` blocks in `design-reference/Wellness App.dc.html` (dark, default) / `Wellness App Light.dc.html` (light) / `Wellness App Tablet.dc.html` (tablet) — grep the flag name to jump straight to that screen's markup and exact values.
- Tablet layouts are built **together with phone**, inside the same task, not as a separate retrofit pass — per spec, most screens are just the phone layout at a wider centred width (`layout.maxContentWidth`); only Team Home (3.3) gets a genuine split-view.
- Accessibility requirements are **inline, per screen** — every screen-build task's "Done when" includes its a11y criteria, not deferred to a single end-of-project sweep. Epic 6 still carries a final cross-cutting audit for what can't be caught screen-by-screen (Reduce Transparency, dynamic-type extremes, full VoiceOver/TalkBack run-through).
- No task carries an hour estimate — scope and acceptance criteria only, sequenced for a 10–15 hrs/week solo cadence.

## Open decisions carried in this doc (don't silently resolve these — flag if you hit one)

| # | Decision | Current status |
|---|---|---|
| 1 | Radar chart vs bar-chart fallback (tech plan §10) | **Resolved: true radar chart**, custom `react-native-svg`. |
| 2 | Deep links: custom scheme vs universal links | **Resolved for v1: custom scheme** (`tulla://`, already in `app.json`). Revisit in Epic 8 once a marketing-site domain exists — see 8.4. |
| 3 | RevenueCat product pricing (`coach_monthly`/`coach_annual`) | **Not decided.** IDs are final; use placeholder sandbox pricing to unblock 4.x, swap before 8.x submission. |
| 4 | Trial length | **Config-driven from day one** for A/B testing — see 4.4 for the mechanism (this is a deliberate elaboration on tech plan §7's literal example SQL, which hardcodes 7 days; see that task for why). |
| 5 | GitHub repo | Doesn't exist yet — created in 1.1. `github` MCP was failing auth as of the last check; use `gh` CLI directly if the MCP still isn't connected when 1.1 comes up. |
| 6 | Supabase project | Doesn't exist yet — created fresh in 1.5, via Supabase MCP. |
| 7 | Vendor accounts (RevenueCat, Sentry, Mixpanel, Resend) | Accounts exist at the org level; **nothing configured for this specific app yet** — each relevant task includes the "create the project/app inside the existing account" step. |
| 8 | iOS bundle ID / Android package | `com.alastairrmcneill.tulla` — set in 1.2. |
| 9 | Apple Developer Program / Google Play Console | Already enrolled — no setup task needed for either. |

---

## Epic 0 — Design System & Theme Foundation

Predates this plan; recorded here for the history this document is meant to be.

### 0.1 — Design tokens (spacing, radius, typography, motion) `[x]`
**References:** tech plan §9; every hex/size/weight value cross-referenced against all three `design-reference/*.dc.html` files.
**Implementation:** `src/theme/tokens.ts` — 4pt spacing scale, Material-3-shape-scale radius (`none…full`), Material-3-type-scale typography (`display/headline/title/body/label` × `Large/Medium/Small`, plus `overline`/`mono`), motion (`duration`/`easing`), `layout` constants (tab bar height, hairline, max content width).
**Done when:** committed — `a56b723`.

### 0.2 — Colour tokens (dark + light) and `ThemeProvider` `[x]`
**References:** tech plan §9, §11 (Reduce Transparency fallback requirement); product spec §11 accessibility (colour-never-alone), §12.
**Implementation:** `src/theme/colors.ts` (`dark`/`light`, semantic roles: `background`/`surface`/`text`/`accent`/`status.{danger,warning,success}`/`glass.{tabBar,sheet}` with flat fallback colours for Reduce Transparency and Android). `src/theme/theme-context.tsx` — `ThemeProvider` + `useTheme()`, seeds `dark` regardless of OS setting (product spec: theme is a user preference, not a system-follow).
**Done when:** committed — `a56b723`.

### 0.3 — Native appearance sync (`Appearance.setColorScheme`) `[x]`
**References:** discovered as a bug during 0.2's verification — `NativeTabs` (iOS Liquid Glass tab bar) is real SwiftUI and reads the OS trait collection directly, ignoring the JS `colors` object, which produced a light/dark flicker on every tab press.
**Implementation:** `theme-context.tsx` calls `Appearance.setColorScheme(mode)` once at module load and in a `useLayoutEffect` keyed on `mode`, forcing native chrome to track our theme instead of device Settings.
**Done when:** committed — `a56b723`. Revisit if `userInterfaceStyle: "automatic"` in `app.json` ever needs to change alongside this.

---

## Epic 1 — Foundation

Nothing in Epics 2–5 can start for real until this epic's data/auth/observability spine exists. Tech plan §15 calls this out as the literal first phase.

### 1.1 — GitHub repo `[x]`
**Depends on:** nothing.
**References:** tech plan §14 (CI needs a remote to attach Actions to).
**Implementation:**
- Create a private GitHub repo (`gh repo create` if the `github` MCP is still failing auth — check `/mcp` first per `CLAUDE.md` tools guidance).
- Push current `main` history as-is (three existing commits) — don't squash, this plan explicitly treats git history as project history.
- Set default branch protection: require the CI check (added in 1.14) to pass before merge, once that check exists — don't block on it now.
**Done when:** `git remote -v` shows the GitHub remote, `main` pushed, repo visible in GitHub.

### 1.2 — App identity & config `[x]`
**Depends on:** nothing.
**References:** tech plan §12 (env/build profiles depend on the app identity existing first).
**Implementation:**
- `app.json`: add `ios.bundleIdentifier` and `android.package`, both `com.alastairrmcneill.tulla`.
- Confirm `scheme: "tulla"` (already present) — this is what 1.8's deep-link config and 3.10's join-team links both rely on.
- Decide real `name`/display name if "tulla" (lowercase, Expo default) isn't the intended user-facing app name — confirm before touching store listings in Epic 8.
- Leave icon/splash assets as the current Expo-starter placeholders for now — real icon generation is a separate, later pass (the `app-icon` skill), not part of this plan's code epics.
**Done when:** `app.json` has both identifiers, app still builds locally (`npx expo start`).

### 1.3 — EAS project + build profiles `[x]`
**Depends on:** 1.2.
**References:** tech plan §2 ("set up an EAS development build on day one, not Expo Go"), §12 (three profiles).
**Implementation:**
- `eas init` to link the project to an EAS account.
- `eas.json` with all three profiles now (even though `preview`/`production` won't be *used* until Epics 7–8): `development` (dev client, internal distribution), `preview` (internal distribution — TestFlight / Android internal testing track), `production` (store release).
- Confirm `expo-dev-client` is installed (required for `development` profile).
**Done when:** `eas.json` committed with all three profiles; `eas build --profile development --platform ios` queues successfully (doesn't need to finish before moving on, just needs to queue without config errors).

### 1.4 — Liquid Glass smoke test `[x]`
**Depends on:** 1.3.
**References:** tech plan §2 ("Liquid Glass smoke test" as the explicit first-phase gate), §9, §11 (Reduce Transparency fallback).
**Implementation:**
- Install `expo-glass-effect` (already a dependency per `package.json` — confirm version is current).
- Build a throwaway glass surface (e.g. wrap the existing `explore.tsx` screen's link button) using `expo-glass-effect`, run it through the **real dev build** from 1.3 on an iOS 26 simulator — Expo Go will not render this, don't try.
- Confirm the fallback path: check `AccessibilityInfo.isReduceTransparencyEnabled()` renders `colors.glass.tabBar.fallbackBackground` / `colors.glass.sheet.fallbackBackground` (already defined in 0.2) instead of the glass effect when enabled.
- Delete the throwaway surface once confirmed working — this task is a gate, not a shipped component (real glass components come in 6.1).
**Done when:** glass effect visibly renders on iOS 26 dev build; toggling Reduce Transparency in the simulator's Accessibility settings shows the flat fallback instead.

### 1.5 — Supabase project `[x]`
**Depends on:** nothing.
**References:** tech plan §1, §3.
**Implementation:**
- Create a fresh Supabase project via the Supabase MCP (`mcp__supabase__create_project`) — check org via `list_organizations` first if more than one exists.
- Install/confirm the Supabase CLI locally, `supabase link` to the new project.
- `supabase/migrations/` directory created per tech plan §2's repo structure (empty, ready for 1.6).
- Record the project URL and anon key locations for 1.13's `lib/supabase.ts` and for EAS env vars (1.3 profiles will need these — come back and add them once this task lands).
**Done when:** `supabase projects list` shows the linked project; `list_tables` via MCP returns the empty default schema.

### 1.6 — Core schema migration `[x]`
**Depends on:** 1.5.
**References:** tech plan §3 (full table list and rationale — read this section in full before writing DDL, don't just skim the table).
**Implementation:** one migration (`mcp__supabase__apply_migration`) creating, in dependency order:
- `profiles` (`id` FK `auth.users`, `name`, `notification_time`) — **no `theme` column** (device-local per §3), **no billing columns** (own table, see next).
- `billing_status` (`profile_id` FK `profiles` PK, `trial_started_at`, `trial_length_days` int default 7, `subscription_active` bool default false, `subscription_expires_at`, `revenuecat_customer_id`) — **`trial_length_days` is an addition beyond the tech plan's literal schema**, needed for 4.4's config-driven trial length; note it inline in the migration comment so a future reader isn't confused why it's here.
- `teams` (`id`, `name`, `sport`, `created_by` FK `profiles`, `join_code` unique, `created_at`).
- `team_members` (`id`, `team_id`, `profile_id`, `role` check in `('athlete','admin')`, `consent_given_at`, `joined_at`).
- `custom_questions` (`id`, `team_id`, `question_text`, `type` check in `('scale','yes_no','text')`, `required` bool, `sort_order` int) — add a check or trigger enforcing max 2 per `team_id` (tech plan leaves this as "application layer or check constraint" — prefer a trigger, it's the layer that can't be bypassed by a bug in one screen).
- `daily_checkins` (`id`, `profile_id`, `date`, `fatigue`, `sleep`, `muscle_soreness`, `stress`, `mood` all int check 1–5, `availability` int check 1–3, `wellness_score` numeric, `created_at`) — `unique(profile_id, date)`.
- `custom_question_responses` (`id`, `checkin_id` FK `daily_checkins`, `custom_question_id` FK `custom_questions`, `response_value`).
- `body_map_entries` (`id`, `profile_id`, `date`, `location`, `severity` check in `('mild','moderate','severe')`, `note`, `created_at`).
- `rpe_logs` (`id`, `profile_id`, `logged_at` timestamptz, `rpe_value` int check 1–10, `note`).
- `notifications` (`id`, `profile_id`, `type`, `title`, `body`, `read` bool default false, `related_team_id`, `created_at`).
- Indexes: `daily_checkins(profile_id, date)`, `team_members(team_id, profile_id)`, `rpe_logs(profile_id, logged_at)` at minimum.
**Done when:** migration applies cleanly; `list_tables` shows all 10 tables with the right columns; `get_advisors` (security/performance) run once and any real findings noted (not necessarily fixed yet — RLS is next).

### 1.7 — Row-Level Security `[x]`
**Depends on:** 1.6.
**References:** tech plan §4 in full — this section's SQL is close to copy-ready, the task is applying it correctly and extending it to every table it says to extend it to.
**Implementation:**
- Enable RLS on every table from 1.6.
- `billing_status`: `select` policy `profile_id = auth.uid()`, **no** `insert`/`update`/`delete` policy for `authenticated` at all — writes only via `service_role` (webhook in 4.8, trigger in 4.3).
- `has_coach_access(p_profile_id uuid)` function — per tech plan §4's example, but reading `trial_length_days` from the row instead of a hardcoded `interval '7 days'` (ties to 1.6's schema addition and 4.4).
- `daily_checkins`: own-row `select`/`insert`/`update`; coach `select` via the `team_members` join + `has_coach_access()`, exactly as tech plan §4's example. No policy grants cross-athlete reads — confirm default-deny by testing, don't just assume.
- Apply the same coach-gated-`select` pattern to `body_map_entries`, `rpe_logs`, `custom_questions`, `custom_question_responses`.
- `team_members`: roster visibility (name, role — not wellness data) readable by any member of the same team regardless of `has_coach_access()` — seeing who's on the team isn't the paid part.
- `teams`: readable by members; `insert` by any authenticated user (team creation itself isn't gated — the *trial* is what's gated, per §7); `update` by admins of that team only.
- `notifications`: own-row `select`/`update` (marking read) only.
**Done when:** for each table, at least one manual test via `execute_sql` (impersonating different `auth.uid()` values, or via two test accounts) confirming both an allowed read and a denied read behave as expected — not just "policy exists," actually exercised once.

### 1.8 — Supabase Auth configuration `[x]`
**Depends on:** 1.5.
**References:** tech plan §5; product spec §3 step 7 (sign-up framing), §15 (no social login in v1).
**Implementation:**
- Enable email/password + magic link providers in Supabase Auth settings; confirm social providers stay off.
- Configure the magic-link and password-reset **email templates** — default Supabase templates are unstyled, tech plan explicitly calls out doing this early rather than shipping the default.
- Set the auth redirect URL to the `tulla://` custom scheme (open decision #2 — resolved as custom-scheme-only for v1).
- Deep link routing: confirm `tulla://auth/callback` (or whatever path is chosen) reaches Expo Router correctly via `expo-linking`; same mechanism will carry `tulla://join/[code]` for 3.10 later, so verify the general scheme-routing pattern here, not just the one auth path.
**Done when:** a real magic-link email round-trips from send → tap → app opens to the right screen, tested on a physical device or simulator with mail access.

### 1.9 — Auth flow in-app `[ ]`
**Depends on:** 1.7, 1.8, 1.13.
**References:** product spec screen 2 (sign up / log in), §3 step 7.
**Implementation:**
- `hooks/useAuth.ts` — wraps Supabase session state, exposes current user/profile, sign-up, log-in (password + magic-link request), sign-out.
- Sign-up/log-in screens under `(auth)/` — kept minimal for now (this task is the *mechanism*, not the onboarding-framed version of these screens, which is 5.6's job — that task restyles/re-places these into the onboarding flow, this task just needs them working standalone).
- On successful sign-up, insert the corresponding `profiles` row (trigger on `auth.users` insert, or an explicit client call right after sign-up — prefer the trigger, it can't be skipped by a client bug).
- Session persistence across app restarts (Supabase JS handles this via its storage adapter — confirm it's configured with a persistent adapter, not the in-memory default).
**Done when:** sign-up, log-in, log-out, and session-restore-on-relaunch all work end to end against the real Supabase project.

### 1.10 — Sentry `[x]`
**Depends on:** 1.3.
**References:** tech plan §11 ("the old Flutter app had no crash reporting at all... set this up in Phase 1").
**Implementation:**
- Create a Sentry project for this app inside the existing org account (open decision #7).
- `@sentry/react-native` install, init in app entry with the DSN from EAS env (per 1.5's note to come back and add env vars).
- Wire source-map upload via EAS Build hooks so production stack traces are readable.
- `lib/sentry.ts` per tech plan §2's repo structure.
- Verify using the Sentry MCP (per `CLAUDE.md` tools instruction — don't just assume the integration code is sufficient): trigger a test error, confirm it lands in the Sentry project via `mcp__claude_ai_Sentry__search_issues` or equivalent.
**Done when:** a deliberately-thrown test error appears in Sentry, confirmed via the MCP, then removed from code.

### 1.11 — Mixpanel `[x]`
**Depends on:** 1.3.
**References:** tech plan §7 (event set, identify/alias pattern), §11.
**Implementation:**
- Create a Mixpanel project for this app inside the existing org account.
- SDK install, `lib/mixpanel.ts`.
- Anonymous identify on first open: locally generated UUID via `expo-secure-store`, `mixpanel.identify(anonId)` — this is infra only in this task; the actual funnel *events* (§7's list) get wired per-flow as those flows are built (5.7 is where the full event set lands), but the `alias()`-on-signup call belongs here since it's directly tied to 1.9's auth flow.
- Wire `mixpanel.alias()` into 1.9's sign-up success path.
**Done when:** a test event appears in Mixpanel, confirmed via the Mixpanel MCP (`Get-Events`/`Run-Query`), then the anon-identify → alias round trip verified with one real sign-up.

### 1.12 — Client library scaffolding `[x]`
**Depends on:** 1.5.
**References:** tech plan §2 repo structure.
**Implementation:** `lib/supabase.ts` (client singleton, typed via `mcp__supabase__generate_typescript_types` into `types/database.ts`), plus confirm `lib/sentry.ts` (1.10) and `lib/mixpanel.ts` (1.11) already match this structure. `lib/revenuecat.ts` and `lib/notifications.ts` are stubbed here (empty exports) so the repo structure exists ahead of Epics 4/5 filling them in.
**Done when:** `types/database.ts` generated and imported by `lib/supabase.ts`'s typed client; no `any` on query results for the tables from 1.6.

### 1.13 — Navigation scaffold `[ ]`
**Depends on:** 1.2.
**References:** tech plan §2's full route tree; product spec §4 (tab structure), §5 (screen inventory — use this to confirm every route below has a home).
**Implementation:**
- Route groups per tech plan §2: `(onboarding)/`, `(auth)/`, `(tabs)/{today,history,teams,settings}`, `team/[id]/{index,athlete/[athleteId],roster,questions,paywall,locked}`.
- Placeholder screens (a screen name + "not built yet" text) for every route in the tree — this task is the skeleton, not the content; every later screen task fills one of these in rather than creating a new route.
- Replace the current placeholder `app-tabs.tsx`/`app-tabs.web.tsx` (Expo-starter demo tabs) with the real 4-tab structure (Today/History/Teams/Settings) — still using `NativeTabs` on iOS per Epic 0's theme wiring, `.android.tsx` Material variant deferred to 6.2 (use the same `NativeTabs` cross-platform component for now, don't build the Android-specific one yet — that's real scope, tracked separately).
**Done when:** every screen in product spec §5's 20-screen inventory has a corresponding route (even if empty), tab bar navigates between the 4 real tabs, `expo-router`'s typed routes compile clean.

### 1.14 — CI pipeline `[ ]`
**Depends on:** 1.1.
**References:** tech plan §14 ("single, lightweight GitHub Actions workflow: typecheck + lint on every pull request... nothing more elaborate").
**Implementation:**
- `.github/workflows/ci.yml` — on PR: `npm ci`, `tsc --noEmit`, `npm run lint`.
- Note from earlier debugging: `expo lint` auto-installs ESLint config on first run in an environment that doesn't have one yet — make sure this is resolved (an `eslint.config.js` committed) before wiring CI, or the workflow will try to auto-install mid-run, which isn't appropriate for a CI environment.
- No build/deploy steps in this workflow — `eas build` stays manual/CLI-triggered per tech plan §14.
**Done when:** a throwaway PR with a deliberate type error shows the check failing; fixing it shows the check passing.

---

## Epic 2 — Athlete Core (always-free)

The free, no-team-required side of the product. Product spec §1: "individual athlete tracking is free forever" — nothing in this epic should end up gated behind `has_coach_access()`.

### 2.1 — Personal baseline computation `[ ]`
**Depends on:** 1.6.
**References:** product spec §6.1 (done-state radar vs baseline), §6.4 (history line chart vs baseline); tech plan §3 ("flagged list is computed, not stored" — same principle applies to an individual's own baseline).
**Implementation:**
- A Postgres view or function computing each profile's rolling baseline per check-in metric (fatigue/sleep/soreness/stress/mood) — a trailing-N-day average is the obvious default; confirm window length (suggest 14 days, adjust if it produces obviously noisy results once real data exists).
- Exposed in a way both the athlete's own radar/history (this epic) and the coach's flagged-list logic (3.1) can reuse — don't write two separate baseline calculations.
**Done when:** querying the view/function for a seeded test profile returns a sane per-metric baseline; confirmed it updates as new check-ins are added (not a static snapshot).

### 2.2 — Offline-first write queue `[ ]`
**Depends on:** 1.6.
**References:** product spec §13 in full — this is a hard requirement, not a nice-to-have ("must never be lost due to connectivity").
**Implementation:**
- A shared local-write utility used by check-in submit (2.5), RPE log (2.8), and body-map entry (2.7): save to local device storage **immediately** on submit (before any network call), queue a background sync with retry.
- A subtle, non-blocking "syncing" indicator — never blocks the UI on network, per spec wording exactly.
- Conflict handling: since these are all append-only, single-writer records (`unique(profile_id, date)` on check-ins aside), last-write-wins is acceptable — don't over-engineer merge logic here.
**Done when:** submitting a check-in in airplane mode shows the local save succeed immediately, syncs automatically once connectivity returns (tested by toggling airplane mode mid-flow), and the syncing indicator reflects both states correctly.

### 2.3 — Radar chart component `[ ]`
**Depends on:** 0.1 (typography/colour tokens), 2.1 (baseline data to plot).
**References:** tech plan §10 (explicit real-scope flag: "most RN chart libraries don't support polar/radar charts... custom implementation using `react-native-svg` directly"); design-reference — the athlete-path preview block in `onPreview` (svg radar markup already exists there as a reference for exact geometry/style, e.g. `polygon points=...` with metric vertices).
**Implementation:**
- `components/charts/RadarChart.tsx` — `react-native-svg` polygon plot, one axis per check-in metric (fatigue/sleep/soreness/stress/mood), current value vs personal baseline as two overlaid polygons.
- Pull the exact stroke/fill colours from `colors.accent`/`colors.status.*` (theme tokens), not hardcoded hex — matches `CLAUDE.md`'s design-fidelity rule.
- Reusable with different data (today's check-in vs baseline for 2.6; a specific athlete's data for coach-side 3.5) — don't couple it to a specific query, take plain numeric props.
- VoiceOver/TalkBack: expose the underlying values as an accessible summary (e.g. "Fatigue 4 of 5, baseline 3.2") since the shape itself conveys nothing to a screen-reader user.
**Done when:** renders correctly with fixture data at both a phone and tablet width; passes a VoiceOver pass reading out real values, not just "image."

### 2.4 — Body map SVG component `[ ]`
**Depends on:** 0.1.
**References:** tech plan §10 (explicit real-scope flag: "no off-the-shelf RN package... custom SVG work... budget real time"); product spec §6.2.
**Implementation:**
- `components/charts/BodyMap.tsx` — front/back body silhouette as `react-native-svg` paths, one tappable region per body area (enough granularity to be useful — e.g. hamstring vs calf vs quad as distinct regions, not just "leg").
- Tap opens a small severity picker (mild/moderate/severe) plus optional one-line note — this task builds the component and its picker sheet; screen-level wiring (conditional trigger, "something hurts?" entry point) is 2.7.
- Front/back toggle.
- Each tappable region needs an accessible label and a way to reach it without a precise tap (VoiceOver/TalkBack region-by-region navigation, not solely gesture-dependent) — per product spec §12.
**Done when:** every defined region is tappable and opens the severity picker; writes a `body_map_entries` row on confirm; passes a screen-reader pass that can identify and select a region without sighted tapping.

### 2.5 — Daily check-in screen (Today tab) `[ ]`
**Depends on:** 1.13, 2.2.
**References:** product spec §6.1 in full (exact question order, labels, submit-gating rule); design-reference `onQuiz`-adjacent check-in styling patterns (scale picker visual style is shared with the onboarding quiz's option-picker — reuse that visual pattern, don't invent a second one).
**Implementation:**
- Single scrolling screen, all questions visible (not a wizard) — spec is explicit this keeps it under a minute.
- Fatigue/sleep/soreness/stress/mood: 1–5 labelled scale (fatigue's labels are given verbatim in spec: "Always tired" → "Very fresh" — get the other four metrics' label wording from the design reference's `Question` model copy, don't invent new wording).
- Availability: 3-point smiley-icon pattern (reduced/available/fully available).
- Custom questions (0–2): rendered below a "Questions from your coach" divider — this section only appears once 3.7 exists and the athlete is on a team with questions configured; build the rendering slot now, it'll just be empty until then.
- Submit disabled until all core (non-custom) questions answered.
- `wellness_score` calculation — tech plan doesn't specify the formula; use a simple average of the five 1–5 metrics normalized to a 0–100 (or whatever scale the radar/history charts expect) — flag this as a placeholder formula worth revisiting once real usage exists, not a locked-in decision.
- On submit: write via 2.2's offline queue; if `muscle_soreness <= 2`, route to the body-map screen (2.7) before the done state; otherwise go straight to done state (2.6).
- Full VoiceOver/TalkBack labels and values on every scale/picker (not just visual state) — product spec §12 requirement, and minimum tap target size per platform guidance on every scale picker option.
**Done when:** a full check-in submits successfully offline and online, routes correctly based on the soreness answer, and a screen-reader user can complete the entire form using only VoiceOver/TalkBack.

### 2.6 — "Done for today" state `[ ]`
**Depends on:** 2.3, 2.5.
**References:** product spec §6.1 ("otherwise go straight to a 'You're done for today' state with today's radar chart vs. personal baseline").
**Implementation:** replaces the check-in form on the Today tab once today's `daily_checkins` row exists for this profile — today's values plotted against baseline via 2.3's `RadarChart`.
**Done when:** re-opening the Today tab after submitting shows this state, not the form again, for the rest of that calendar day.

### 2.7 — Body map screen wiring `[ ]`
**Depends on:** 2.4, 2.5.
**References:** product spec §6.2 (both trigger paths: automatic on low soreness, and the "always-available 'something hurts?' link").
**Implementation:**
- The automatic post-submit route from 2.5.
- A persistent, always-reachable manual entry point (spec says "always-available" — put it somewhere that's actually reachable from Today regardless of check-in state, e.g. a small link near the top of the Today tab).
- Both paths land on the same screen/component from 2.4.
**Done when:** both entry paths work and both write to `body_map_entries` identically.

### 2.8 — Log a Session (RPE) `[ ]`
**Depends on:** 1.13, 2.2.
**References:** product spec §6.3 (no session-calendar gating in v1 — always available, per §15's explicit deferral).
**Implementation:**
- Floating action button, persistent on Today and History tabs (iOS: Liquid Glass FAB per tech plan §9 — build with a plain styled button for now if 6.1 hasn't landed yet, upgrade the visual treatment in 6.1 rather than blocking this task on it).
- Opens a sheet: "How hard did that session feel?" 1–10 tap-to-select, optional one-line note, one-tap submit.
- Writes via 2.2's offline queue to `rpe_logs` with a real timestamp (not just date — spec notes multiple sessions/day are possible).
**Done when:** reachable from both tabs, submits offline and online, multiple same-day logs both persist correctly.

### 2.9 — History screen `[ ]`
**Depends on:** 1.13, 2.1.
**References:** product spec §6.4; tech plan §10 (`react-native-gifted-charts` for the line chart, `react-native-calendars` for the calendar — both flagged as low-risk standard integrations, unlike 2.3/2.4).
**Implementation:**
- Line chart: wellness score over time vs personal baseline, via `react-native-gifted-charts`.
- Calendar view: colour-coded daily averages, via `react-native-calendars` — colour coding must pair with a text/icon cue too, not colour alone (product spec §12's traffic-light rule isn't limited to the flagged list specifically, apply the same principle here).
- Load-trend indicator: "Training load this week: ↑ / → / ↓ vs last week" computed from `rpe_logs` — a plain trend arrow, explicitly **not** a numeric ACWR ratio (deferred, product spec §15).
- Empty state for a new athlete with no history yet — explanatory, not a blank chart (product spec §14).
**Done when:** all three elements render against real seeded data across a multi-week range; empty state confirmed for a freshly created profile.

---

## Epic 3 — Coach Core

The paid product surface. Building this doesn't itself require billing to be wired — Epic 4 gates *access* to what this epic builds, it doesn't change what gets built.

### 3.1 — Flagged-list computation `[ ]`
**Depends on:** 1.6, 1.7, 2.1.
**References:** tech plan §3 ("flagged list is computed, not stored — a query/view joining recent daily_checkins against each athlete's own rolling baseline, plus recent body_map_entries and rpe_logs load trend"); product spec §6.6 item 2 (merge criteria: below baseline, meaningful pain, rising load trend — one list, sorted by severity).
**Implementation:**
- A Postgres view/function, RLS-gated through `has_coach_access()` (1.7), returning per-team flagged athletes with a reason (below-baseline / pain-reported / rising-load) and a severity ranking for sort order.
- Reuses 2.1's baseline logic — don't recompute it differently here.
- Reason must be expressible as short text/icon, not colour alone (feeds 3.3's chip requirement, and product spec §12).
**Done when:** querying for a seeded team with a mix of normal/flagged athletes returns the right athletes with correct, distinct reasons, correctly excluded once `has_coach_access()` is false for that team's admin.

### 3.2 — Create Team screen `[ ]`
**Depends on:** 1.9, 1.13.
**References:** product spec §6.5, screen 9.
**Implementation:**
- Name (required), sport tag (optional), on submit: generate a unique `join_code`, insert `teams` row, insert a `team_members` row for the creator as `admin`.
- The actual trial-start trigger call is 4.3's job — this task should call whatever function/endpoint 4.3 will define, but it's fine to build this screen against a stub/no-op first and wire the real trigger when 4.3 lands, rather than blocking this screen on Epic 4.
- Lands on Team Home (3.3) with the trial banner visible once 4.x exists — again, build against a stub banner state for now.
**Done when:** creating a team produces a working `teams`/`team_members` pair with a valid unique join code, navigates to Team Home.

### 3.3 — Team Home screen (phone + tablet) `[ ]`
**Depends on:** 1.13, 3.1, 3.2.
**References:** product spec §6.6 in full (the five stacked sections, in order) and §4 (tablet split-view spec: flagged/roster list left ~35%, athlete detail right ~65%, everything else full-width above it).
**Implementation:**
- Trial/subscription status banner (stub copy/state until 4.5 wires the real value).
- Flagged list (3.1) — each row: name, reason chip, tap → athlete detail (3.5).
- "Today's completion" — "N of M checked in today," tap to see who's missing, one-tap "send reminder" push per missing athlete. **The push-send itself depends on 5.8's notification infra**, which comes later in the sequence — build this button to call a clearly-named stub function now (e.g. `sendCheckinReminder(athleteId)` that currently just logs/no-ops), swap in the real implementation when 5.8 lands rather than blocking this whole screen on it.
- Team wellness trend — small chart, team average over last 2 weeks vs baseline (this can reuse 2.9's line-chart approach, team-aggregated instead of individual).
- "See all responses" → 3.8.
- Tablet: flagged-list + athlete-detail as a genuine split view at the standard tablet breakpoint (items 1/3/4 stay full-width above it) — build this in the same task, per this plan's tablet approach.
- Empty state: "Waiting on your first check-ins," not an empty flagged list with no explanation (product spec §14).
**Done when:** all five sections render against seeded data on both phone and tablet simulators; empty-team state confirmed distinct from "team-with-data-but-nobody-flagged" state.

### 3.4 — Athlete Detail screen `[ ]`
**Depends on:** 2.3, 3.3.
**References:** product spec §6.7.
**Implementation:** radar chart (2.3, that athlete's data), personal history line chart (reuse 2.9's chart approach), recent body-map reports, RPE/load history, custom question answers — entirely read-only from the coach's side.
**Done when:** renders correctly both as a full-screen phone route and as the tablet split-view's right pane (same component, different container — don't fork it).

### 3.5 — Roster / Invite screen `[ ]`
**Depends on:** 1.7, 3.2.
**References:** product spec §6.8.
**Implementation:**
- Join code display with a native share-sheet button (`expo-sharing` or RN's `Share` API).
- Member list with role indicator (member/admin), "promote to admin" / "remove" actions per member — both need RLS-safe mutations (only an existing admin can perform these; confirm the RLS policy from 1.7 actually enforces this, don't rely on the UI hiding the buttons alone).
**Done when:** invite share sheet opens with a working join-code payload; promote/remove both work and are blocked at the RLS layer for a non-admin attempting the same request directly.

### 3.6 — Custom Questions setup screen `[ ]`
**Depends on:** 1.6, 3.2.
**References:** product spec §6.9; tech plan §3 (max-2 enforcement).
**Implementation:**
- Up to 2 questions: text, type (scale 1–5 / yes-no / short text), required toggle, live preview of how it renders on the athlete's check-in.
- Follow-up wiring back into 2.5: once this exists, 2.5's "Questions from your coach" section needs to actually query and render `custom_questions` for the athlete's team(s) — treat that as part of *this* task's "done" criteria, not left dangling, since 2.5 was explicitly built with an empty placeholder slot for this.
**Done when:** creating/editing/deleting a question here is reflected live in the check-in screen for a team member; the 3rd-question attempt is blocked with a clear message, not a silent failure.

### 3.7 — All Responses screen `[ ]`
**Depends on:** 1.7, 3.3.
**References:** product spec screen 17, referenced from §6.6 item 5.
**Implementation:** raw list of check-in responses for the team (not the summarized flagged view) — coach-only, RLS-gated same as the rest of the coach-side reads.
**Done when:** reachable from Team Home's "See all responses," shows real per-athlete rows, respects `has_coach_access()`.

### 3.8 — Team Info screen (athlete, read-only) `[ ]`
**Depends on:** 1.7, 3.2.
**References:** product spec §4 (Teams tab → athlete-side team open), §7 (locked-team notice copy, verbatim).
**Implementation:**
- Read-only team view for a member who isn't that team's admin.
- Locked-team notice, exact copy from spec §7: *"Your coach's trial has ended — your check-ins still work, but they won't be shared with the team until they resubscribe"* — condition this on the team's `has_coach_access()` state (stub the condition against 4.x's real value for now, same pattern as 3.2/3.3).
- Custom questions from this team simply stop appearing on the athlete's check-in (2.5) while locked — note this as a cross-cutting condition on 2.5's "Questions from your coach" query, not just a copy change here.
**Done when:** an athlete on a locked team sees the notice and keeps their own check-ins working normally; an athlete on an active team sees no notice.

### 3.9 — Join Team + Consent flow `[ ]`
**Depends on:** 1.7, 1.8 (deep link routing), 3.2.
**References:** product spec §6.10 in full, including the exact consent copy template.
**Implementation:**
- Join-code entry screen (manual code entry) **and** arrival via the `tulla://join/[code]` deep link (reuses 1.8's scheme-routing pattern) — both paths converge on the same consent screen.
- Consent screen: team name, coach's name, the exact copy template from spec §6.10 with `[Coach Name]`/`[Team Name]` interpolated. Two buttons: "Join team" (primary, writes `team_members.consent_given_at`) / "Not now."
- One-time per team — if already a member with consent given, joining again (e.g. re-tapping an old invite link) should skip straight past this, not re-prompt.
**Done when:** both entry paths reach the same consent screen with correct interpolated names; declining leaves no `team_members` row; accepting sets `consent_given_at` and a check-in submitted afterward is visible to that team's coach (verified against 1.7's RLS, which requires `consent_given_at` conceptually even if not literally checked in the policy — confirm whether it should be, per product spec §8's "consent screen is mandatory before a check-in becomes visible to a coach," and add that condition to the coach-read policy from 1.7 if it isn't already there).

---

## Epic 4 — Billing

Depends on both Epic 2 (something free to contrast against) and Epic 3 (something real to gate) existing first, per tech plan §15's own sequencing note.

### 4.1 — RevenueCat SDK setup `[ ]`
**Depends on:** 1.9.
**References:** tech plan §6.
**Implementation:** `react-native-purchases` install, `lib/revenuecat.ts` (filling in 1.12's stub), `Purchases.configure()` on app start with the API key from EAS env, `Purchases.logIn(supabaseUserId)` immediately after Supabase auth succeeds (1.9's auth flow) so RevenueCat and Supabase share one user identity.
**Done when:** `Purchases.getCustomerInfo()` returns successfully against a real logged-in user in a dev build.

### 4.2 — RevenueCat dashboard configuration `[ ]`
**Depends on:** nothing (dashboard-only, no code).
**References:** tech plan §6; open decision #3 (pricing not yet decided).
**Implementation:**
- One entitlement: `coach_access`.
- Two products: `coach_monthly`, `coach_annual` — placeholder/sandbox pricing for now, real pricing swapped in before 8.x store submission (open decision #3, don't block this task waiting for a pricing decision).
- Configure both in App Store Connect / Play Console sandbox too, since RevenueCat products need matching store-side products to actually test purchases.
**Done when:** both products visible and correctly linked to the entitlement in the RevenueCat dashboard; a sandbox purchase completes successfully.

### 4.3 — Database-tracked trial start `[ ]`
**Depends on:** 1.6, 1.7, 3.2.
**References:** tech plan §6 ("trial_started_at set once, server-side... never client-set directly — prevents a device-clock manipulation trick"), §7.
**Implementation:**
- Server-side trigger (Postgres trigger on first `teams` insert by a given `created_by`, checked against that profile's `billing_status` row) or an Edge Function called from 3.2's team-creation flow — trigger is preferable per tech plan's own reasoning (can't be skipped by a client bug), same logic as 1.9's profile-creation trigger choice.
- Sets `trial_started_at = now()`, and `trial_length_days` (1.6's addition) from the caller's assigned experiment variant — see 4.4 for exactly how that variant/length gets resolved; this task defines the trigger's *shape*, 4.4 defines where the length value it uses comes from.
- Wires into 3.2's stubbed trial-start call.
**Done when:** creating a team as a profile with no existing `billing_status` row correctly inserts one with `trial_started_at` set and a real `trial_length_days`; creating a second team for an already-subscribed profile does **not** reset or overwrite an active trial/subscription.

### 4.4 — Config-driven trial length (A/B-test-ready) `[ ]`
**Depends on:** 4.3.
**References:** tech plan §7's closing note ("trial length trivially A/B-testable — a config value, not multiple App Store product SKUs") and §10 (deterministic-hash variant assignment pattern) — this task is where those two notes actually get implemented together, since tech plan §6's literal example SQL hardcodes 7 days and doesn't itself show the mechanism.
**Implementation:**
- `constants/experiments.ts`: a small config mapping variant IDs to trial lengths (e.g. `{ control: 7, variant_b: 5 }`), deterministic hash of the anonymous/user ID decides which variant a given user is in — same mechanism note tech plan §7/§10 describe for onboarding variants, reused here.
- **Security note or it defeats its own purpose:** the trial length that lands in `billing_status.trial_length_days` must come from the **server** resolving the variant→length mapping itself (or at minimum validating a client-supplied variant *ID* against the trusted config, never trusting a raw client-supplied day-count) — otherwise a modified client could just claim a 9999-day trial. 4.3's trigger/function should do this lookup server-side.
- `has_coach_access()` (1.7) already reads `trial_length_days` from the row per that task's note — confirm it does, don't hardcode `interval '7 days'` there.
- Track the assignment as a Mixpanel event/property (ties into 1.11/5.7's event work) so a future trial-length experiment is actually measurable, not just mechanically possible.
**Done when:** two test profiles assigned to different variants (force the hash input if needed to get both outcomes) end up with genuinely different `trial_length_days` values and correspondingly different lockout timing.

### 4.5 — Trial banner + `useCoachAccess()` `[ ]`
**Depends on:** 4.3, 4.4.
**References:** tech plan §6 ("a `useCoachAccess()` hook wraps it client-side for UI state, but the *real* enforcement is the RLS policy, not the hook").
**Implementation:**
- `hooks/useCoachAccess.ts` — reads `billing_status` for the current user's relevant team, returns access state + days-remaining, purely for UI display. Explicitly not the enforcement layer — RLS already is.
- Wire the real value into 3.3's stubbed trial banner ("Free trial: N days left," or no banner if this is an additional team under an existing subscription).
**Done when:** the banner shows correct live countdown against a real trial row, and correctly shows nothing for a second team created under an active subscription.

### 4.6 — Trial-expired lockout screen `[ ]`
**Depends on:** 4.5.
**References:** product spec §7 ("full lockout of Team Home... blocking screen... single purchase button"), screen 18.
**Implementation:** replaces Team Home entirely once `has_coach_access()` is false for that team's admin — single CTA, copy per spec §7. Reachable specifically from wherever the trial banner would otherwise be, per product spec's flow note.
**Done when:** an expired-trial admin sees this screen instead of Team Home, with no way to reach the real Team Home content underneath it (verify at the RLS layer too, not just that the UI route redirects — a locked-out coach's app should genuinely fail to fetch team data, per tech plan §4's framing).

### 4.7 — Purchase flow `[ ]`
**Depends on:** 4.1, 4.2, 4.6.
**References:** tech plan §6, §7 ("this is the one and only moment an actual RevenueCat/IAP transaction happens").
**Implementation:**
- `Purchases.purchasePackage()` triggered only from the lockout screen (4.6) and the coach-path paywall (5.x, once onboarding lands) — no other purchase entry points in v1.
- Fetch the active offering via `Purchases.getOfferings()` for RevenueCat Experiments-driven price/package variants (tech plan §7) — render whatever RevenueCat serves, don't hardcode a price in the UI.
- On success: client refreshes `customerInfo` immediately on foreground (don't wait on the webhook round-trip from 4.8 to unlock).
**Done when:** a sandbox purchase from the lockout screen unlocks Team Home immediately, client-side, without needing to wait for 4.8's webhook.

### 4.8 — `revenuecat-webhook` Edge Function `[ ]`
**Depends on:** 1.7, 4.2.
**References:** tech plan §6.
**Implementation:**
- Supabase Edge Function receiving RevenueCat webhook events, writing `billing_status.subscription_active`/`subscription_expires_at` via `service_role` (the one path that legitimately bypasses RLS, per 1.7's design).
- Handle `INITIAL_PURCHASE`/`RENEWAL` (set active), and **`EXPIRATION`/`CANCELLATION`** explicitly (set `subscription_active = false`) — tech plan is explicit this second half is what re-triggers lockout for a lapsed subscriber, not just first-time trial expiry, don't build only the happy path.
- Verify the webhook signature (RevenueCat provides a shared secret for this) — don't accept unauthenticated webhook calls that can flip billing state.
**Done when:** a sandbox-triggered `EXPIRATION` event correctly flips `subscription_active` to false and the corresponding coach sees the lockout screen (4.6) on next app foreground.

### 4.9 — Restore Purchases `[ ]`
**Depends on:** 4.1.
**References:** product spec §7, §6.12 (Settings screen requirement); tech plan §6 ("required by App Store review guidelines").
**Implementation:** a Settings-screen button (5.12 builds the rest of that screen — this task can land the button in isolation against a placeholder Settings screen if 5.12 hasn't landed yet, then 5.12 just needs to include it) calling `Purchases.restorePurchases()`.
**Done when:** restoring on a fresh install/device with a prior real (sandbox) purchase correctly re-unlocks access.

### 4.10 — Dynamic paywall headline `[ ]`
**Depends on:** 4.7, 5.3 (onboarding Q3 challenge answer needs to exist first).
**References:** product spec §3 step 8 ("headline dynamically pulls the Q3 challenge answer... e.g. 'spotting fatigue' → 'Catch fatigue on your team before it becomes a problem'").
**Implementation:** map each of the four Q3 challenge options (spec §3 item 3) to a headline string, sourced from `constants/experiments.ts`-style config per tech plan §10 ("pulled from config rather than hardcoded, specifically so a variant can ship without an app store release") — not hardcoded per-screen conditionals.
**Done when:** each of the four challenge answers produces its correct distinct headline on the paywall screen.

---

## Epic 5 — Onboarding + Notifications

### 5.1 — Onboarding flow shell `[ ]`
**Depends on:** 1.13.
**References:** product spec §3, §10 ("every screen and copy string in the onboarding/paywall flow should be pulled from config").
**Implementation:** `(onboarding)/` route group with a config-driven screen sequence (an ordered list of screen configs, not a hardcoded chain of `router.push` calls) so a future variant (spec §10's "full quiz vs 2-question version" test) can reorder/skip screens via config alone.
**Done when:** the full 10-step sequence from spec §3 navigates correctly end to end using placeholder content, driven by the config structure.

### 5.2 — Welcome screen `[ ]`
**Depends on:** 5.1.
**References:** product spec §3 step 1; design-reference `onWelcome` state-flag block (has the exact copy: "Know how you'll train before you turn up," etc — use this verbatim, it's already-approved copy, not a placeholder).
**Implementation:** single strong statement + "Get started" CTA, no sign-up yet.
**Done when:** matches design-reference styling and copy exactly (dark + light).

### 5.3 — Personalization quiz `[ ]`
**Depends on:** 5.1.
**References:** product spec §3 steps 2–4 in full (exact branching logic and options); design-reference `onQuiz` state-flag block.
**Implementation:**
- Q1 role branch (track my own wellness / coach a team / both) — branches subsequent questions, doesn't hard-lock anything later (an athlete-path person can still start a team afterward).
- Athlete-leaning path: sport (short list + "Other"), training frequency buckets, single-select goal.
- Coach-leaning path: sport, squad size buckets, and the challenge question (single-select, 4 options) — **this exact answer is what 4.10 keys off**, so persist it in a form 4.10 can actually read (e.g. as a value on the onboarding-answers state passed through to sign-up/paywall, not discarded after this screen).
- Market-research question (either path): current tracking method — captured to Mixpanel regardless of downstream outcome (ties to 5.7).
- Variant-assignment mechanism (deterministic hash, `constants/experiments.ts`) wired in now even though v1 only has one variant — per tech plan §7's explicit instruction not to build variant-*switching* logic prematurely, but the assignment/tracking plumbing should exist so Variant B slots in later without a release.
**Done when:** both branches complete correctly, the challenge answer is available downstream for 4.10, and an exposure event fires even with only one variant defined.

### 5.4 — Personalizing transition screen `[ ]`
**Depends on:** 5.3.
**References:** product spec §3 step 5; design-reference `onPersonalizing` state-flag block.
**Implementation:** brief animated/loading moment, reuses the design-reference's spinner + rotating status-line copy pattern.
**Done when:** matches design-reference timing/feel, transitions automatically (not user-dismissed) into 5.5.

### 5.5 — Value preview screen `[ ]`
**Depends on:** 2.3, 3.1, 5.3.
**References:** product spec §3 step 6; design-reference `onPreview` state-flag block (has both the coach-path mocked flagged-row and athlete-path mocked radar already built as reference markup).
**Implementation:**
- Coach path: mocked flagged-list entry relevant to the Q3 challenge answer picked in 5.3 — illustrative fixture data, explicitly labelled "not real data" per design reference's own convention, reusing 3.3's flagged-row visual style.
- Athlete path: mocked radar/history preview using 2.3's `RadarChart` with fixture data.
**Done when:** both paths render with fixture data that reflects the specific answers given upstream in 5.3, not a single static example.

### 5.6 — Sign-up screen (onboarding-framed) `[ ]`
**Depends on:** 1.9, 5.5.
**References:** product spec §3 step 7 ("framed as 'save your setup' rather than a cold account wall").
**Implementation:** restyles/re-places 1.9's working auth mechanism into the onboarding flow's visual context and copy framing — this task is presentation and flow-placement, the actual sign-up logic already exists from 1.9, don't rebuild it.
**Done when:** completing onboarding through this screen produces a real authenticated session and carries the onboarding answers forward (role/challenge/etc, needed by 4.10 and by team-creation defaults).

### 5.7 — Mixpanel funnel events `[ ]`
**Depends on:** 1.11, 5.3, 5.6.
**References:** tech plan §7's full event list — implement all of it, not a subset:
`onboarding_started`, `role_selected` (`role`), `challenge_selected` (`challenge`, coach path), `signup_completed`, `trial_started`, `team_created`, `checkin_completed` (`is_first_checkin`), `paywall_viewed`, `purchase_completed`, `trial_reminder_sent` (`channel`, `day`), `flag_triggered` (`reason`).
**Implementation:** fire each event at its correct point across the flows already built in Epics 2–5 — this is a wiring task touching many existing screens, not new UI. Verify anon-identify (1.11) → `alias()` (1.11's sign-up hook) → named events all connect into one funnel per user, not fragmented anon/named timelines.
**Done when:** a full manual run-through (onboarding → signup → team → check-in → paywall → purchase) produces the complete expected event sequence in Mixpanel, verified via the Mixpanel MCP, attributed to one identity throughout.

### 5.8 — Push notification infra `[ ]`
**Depends on:** 1.13.
**References:** tech plan §8; product spec §6.11 (trigger list), screen 19 (in-app inbox).
**Implementation:**
- `expo-notifications` setup, permission prompt, Expo push token registration on grant, `lib/notifications.ts` (filling in 1.12's stub).
- In-app notifications inbox screen (reads the `notifications` table from 1.6) — mirrors every push type for anyone who declined permission, per spec §6.11's explicit requirement.
- This task is the *infrastructure*; the four trigger sources (flag/reminder/daily-self-reminder/trial-ending) are wired in 5.9/5.10/3.3's stub-swap, not duplicated here.
**Done when:** permission flow works, a manually-inserted `notifications` row shows correctly in the inbox, a real Expo push token is obtained and stored against the profile.

### 5.9 — `send-trial-reminders` Edge Function `[ ]`
**Depends on:** 4.3, 5.8.
**References:** tech plan §8 item 1; product spec §9 (exact reminder copy, "day 5 of 7... once").
**Implementation:** Supabase Edge Function, scheduled daily via `pg_cron`, queries `billing_status` joined to `profiles` for accounts at day 5 and at the final day of their trial (respecting 4.4's per-user `trial_length_days`, not a hardcoded day-5-of-7), sends both a push (Expo push API) and an email (5.11's Resend template) — two-channel redundancy per spec.
**Done when:** a test `billing_status` row manually backdated to day 5 correctly triggers exactly one push + one email, and doesn't re-trigger on subsequent daily runs (only fires once per milestone).

### 5.10 — `on-checkin-flag-check` Edge Function `[ ]`
**Depends on:** 3.1, 5.8.
**References:** tech plan §8 item 2; product spec §9 (flag-triggered copy).
**Implementation:** Supabase Database Webhook on insert to `daily_checkins` or `body_map_entries`, computes whether the new entry creates a flag against 3.1's logic, if so pushes near-real-time to the relevant team's admin(s). This is what swaps into 3.3's stubbed reminder-send path conceptually (same push mechanism), and is the real implementation behind product spec §9's "flag triggered" notification.
**Done when:** submitting a check-in that crosses into flagged status produces a push to the team's admin within a few seconds, verified in a real (non-sandbox-delayed) test.

### 5.11 — Resend email templates `[ ]`
**Depends on:** nothing structurally, but pairs with 5.9.
**References:** tech plan §8 ("keep these plain and calm... same message, two channels, not two different tones"); product spec §9's copy tone guidance.
**Implementation:** trial day-5 and trial-final-day templates in Resend, matching the in-app/push copy tone from spec §9 — not a separate marketing-style template.
**Done when:** both templates send correctly via 5.9's function with real interpolated team/name values.

### 5.12 — Settings & Account screen `[ ]`
**Depends on:** 1.9, 4.9, 0.2 (theme toggle).
**References:** product spec §6.12; tech plan §3 (`theme` is device-local, never synced to Supabase).
**Implementation:**
- Theme toggle wired to 0.2's `ThemeProvider.setMode` — persisted to device-local storage (`expo-secure-store`/`AsyncStorage`) per tech plan §3, explicitly **not** a `profiles` column.
- Notification time preference (writes `profiles.notification_time`).
- Account details, change password, delete account (with confirmation — this is a destructive/irreversible action, treat the confirmation UX with the seriousness that implies).
- Privacy policy / terms links, log out.
- Restore Purchases button (4.9 — if that task landed against a placeholder screen, this is where it gets its real home).
**Done when:** every item works; theme choice persists across app restarts without touching Supabase; delete-account genuinely removes/anonymizes the account per whatever the eventual privacy policy commits to (flag if that policy doesn't exist yet to define exact deletion semantics — don't guess at a legal commitment).

---

## Epic 6 — Native Polish

### 6.1 — iOS Liquid Glass full pass `[ ]`
**Depends on:** 1.4.
**References:** tech plan §9, §11.
**Implementation:** real `expo-glass-effect` treatment (beyond 1.4's throwaway smoke test) on: tab bar, sheets/modals (paywall, upgrade prompts, body-map severity picker, RPE sheet), floating action button. Every glass surface needs its defined fallback (0.2's `colors.glass.*.fallbackBackground`) for iOS <26 and Reduce Transparency — verify each surface individually, don't assume one working fallback proves the pattern everywhere.
**Done when:** every listed surface renders glass correctly on iOS 26, and correctly falls back (not broken/transparent) on iOS <26 and with Reduce Transparency enabled.

### 6.2 — Android Material 3 pass `[ ]`
**Depends on:** 1.13.
**References:** tech plan §9.
**Implementation:** React Native Paper primitives for Android-specific chrome — `.android.tsx` variants for tab bar, buttons, sheets, alongside the existing `.ios.tsx` glass versions from 6.1. Everything else (forms, check-in screen, charts, lists) stays shared per tech plan's explicit instruction not to fork components that don't need forking.
**Done when:** Android build shows genuine Material 3 chrome, not an iOS-style imitation; shared components render identically to the iOS build minus the platform-specific chrome.

### 6.3 — Accessibility final audit `[ ]`
**Depends on:** every screen task in Epics 2–5 (each already carries inline a11y criteria — this is the cross-cutting sweep for what inline review can't catch).
**References:** product spec §12 in full.
**Implementation:** dynamic-type stress test at the largest OS text size across every screen (check nothing clips/overlaps), full VoiceOver pass (iOS) and TalkBack pass (Android) end to end through the core paths, Reduce Transparency verification across every glass surface from 6.1, colour-contrast check on `status.*` tokens against both backgrounds.
**Done when:** a written checklist (one line per product spec §12 requirement) is fully checked against a real device run, not simulator-only.

### 6.4 — Offline/empty/error states sweep `[ ]`
**Depends on:** every screen task.
**References:** product spec §14 in full.
**Implementation:** confirm each of: new-athlete empty history (2.9 already builds this — verify), new-team no-responses (3.3 already builds this — verify), invalid join-code inline error (3.9), cached-last-known-state-with-retry on network failure for every read screen (this last one is genuinely cross-cutting and likely needs a shared data-fetching pattern/hook applied consistently — audit for screens that don't yet have it).
**Done when:** each of product spec §14's four bullet points is demonstrably true on a real device with network conditions manipulated (airplane mode, then restored).

### 6.5 — Performance/polish pass `[ ]`
**Depends on:** every screen task.
**References:** general quality bar, not a specific spec section.
**Implementation:** loading skeletons where a blank screen would otherwise show during fetch, list virtualization check on Roster/All-Responses/History for larger teams, image optimization pass.
**Done when:** no visible jank or blank-flash on the core paths during a full manual run-through.

---

## Epic 7 — Pilot Distribution

### 7.1 — `preview` build + store internal tracks `[ ]`
**Depends on:** 1.3, all of Epics 2–6.
**References:** tech plan §12, §15 step 7.
**Implementation:** finalize the `preview` EAS profile, submit to TestFlight (iOS) and the Play Store internal testing track (Android) — no public listing needed at this stage.
**Done when:** a pilot coach can install via TestFlight/internal-testing link and reach a working sign-up.

### 7.2 — Manual smoke-test checklist `[ ]`
**Depends on:** nothing (a document, not code) — but write it after Epics 2–4 exist, so it's testing real paths.
**References:** tech plan §13 ("a short manual smoke-test checklist run before each preview/production build... covering the core paths: sign up → check-in → create team → trial → lockout → purchase → roster/consent").
**Implementation:** a checklist document (could live in this repo, e.g. `docs/SMOKE_TEST.md`) enumerating each step of that core path with a pass/fail line — run it before this build and every subsequent `preview`/`production` build, per tech plan §13's stated cadence.
**Done when:** the checklist exists and has been run at least once against 7.1's build with all steps passing.

### 7.3 — Pilot coach access `[ ]`
**Depends on:** 7.1.
**References:** marketing plan (background only per `CLAUDE.md` — this task is the technical side of that outreach, not the outreach itself).
**Implementation:** confirm the pilot coaches identified in the marketing plan can actually get from a TestFlight/internal-testing invite to a working account with no unexplained friction; set up whatever feedback channel is intended (even something as simple as a shared form/email).
**Done when:** at least one real external pilot coach has successfully created a team and gotten at least one athlete through consent + a check-in.

### 7.4 — Pilot feedback iteration `[ ]`
**Depends on:** 7.3.
**References:** tech plan §15 step 7 ("iterate on real feedback").
**Implementation:** open-ended — feed real pilot feedback back into new tasks appended to the relevant epic above (don't create a parallel untracked backlog; if pilot feedback produces new work, it gets a new numbered task in whichever epic it belongs to, keeping this document the single source of truth).
**Done when:** N/A — ongoing task, closed out by mutual agreement once pilot feedback stops producing material changes.

---

## Epic 8 — Public Release

### 8.1 — App Store Connect listing `[ ]`
**Depends on:** 7.4 (or a deliberate decision to proceed without full pilot iteration).
**References:** out of this plan's code scope — use the `aso-appstore-screenshots` and related ASO skills for the actual asset generation/copy when this task comes up; this plan tracks it only as a checklist item, not detailed implementation.
**Implementation:** icon (real, not the current Expo-starter placeholder from 1.2), screenshots, description, keywords.
**Done when:** listing passes App Store review's metadata checks (before the binary submission in 8.3).

### 8.2 — Play Store listing `[ ]`
**Depends on:** 7.4.
**References:** same note as 8.1.
**Implementation:** equivalent Play Store listing assets.
**Done when:** listing passes Play Console's pre-launch checks.

### 8.3 — Production build + submission `[ ]`
**Depends on:** 8.1, 8.2, 4.2 (real pricing must be finalized by now — open decision #3 has to close before this task, not during it).
**References:** tech plan §12, §15 step 8.
**Implementation:** finalize the `production` EAS profile with real (non-sandbox) RevenueCat pricing, `eas build --profile production` both platforms, submit via `eas submit`.
**Done when:** both apps are live (or in final store review) on their respective stores.

### 8.4 — Universal links upgrade `[ ]`
**Depends on:** a marketing-site domain existing (open decision #2).
**References:** this plan's open decision #2 — explicitly deferred from 1.8/3.9's custom-scheme-only v1 approach.
**Implementation:** once a real domain exists for the Vercel-hosted marketing site (tech plan §1), add `apple-app-site-association` and Android `assetlinks.json`, switch magic-link and team-invite links to `https://` universal links, keep the `tulla://` scheme as a fallback rather than removing it outright.
**Done when:** tapping a magic-link/invite link from a real email client opens the app directly, with the old custom-scheme links still working as a fallback for anyone on an older app version.

### 8.5 — Post-launch monitoring `[ ]`
**Depends on:** 8.3.
**References:** tech plan §11 (Sentry/Mixpanel already wired throughout — this task is establishing the review *cadence*, not new integration work).
**Implementation:** a short written cadence for checking Sentry error rates and the Mixpanel funnel dashboards post-launch (e.g. daily for the first week, weekly after) — document it, don't just do it once and let it lapse.
**Done when:** the cadence is written down somewhere findable (this file or a linked doc) and has been followed for at least the first week post-launch.
