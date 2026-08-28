# Technical Implementation Plan — Tulla

**Status:** v1 build plan, for Claude Code.
**Depends on:** `01-product-spec.md` (screens, flows, paywall mechanics) — read that first, this document is the "how" to its "what."

---

## 1. Stack Overview

| Layer                         | Tool                                                            | Why                                                                                                                     |
| ----------------------------- | --------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------- |
| App framework                 | React Native + Expo (managed, EAS)                              | Fastest AI-assisted iteration, cross-platform, matches team's existing familiarity                                      |
| Language                      | TypeScript, strict mode                                         | Catches errors before runtime, especially valuable given limited manual QA capacity                                     |
| Navigation                    | Expo Router (file-based)                                        | Expo-native, keeps future web-code-sharing option open if ever needed                                                   |
| Backend                       | Supabase (Postgres, Auth, Edge Functions)                       | Relational model fits the reporting/aggregation/RLS access-control needs better than a NoSQL store                      |
| Auth                          | Supabase Auth                                                   | `auth.uid()` flows directly into RLS with no extra sync step; fewer vendors than Clerk for this simple a use case       |
| Payments                      | RevenueCat (StoreKit + Play Billing)                            | Native IAP, per confirmed decision — no web billing                                                                     |
| Push notifications            | Expo Notifications                                              | Native to the Expo/EAS toolchain                                                                                        |
| Transactional email           | Resend                                                          | Backup channel for trial reminders, independent of push permission (see Section 8)                                      |
| Analytics                     | Mixpanel                                                        | Funnel/retention analysis, onboarding experiment tracking                                                               |
| Error tracking                | Sentry                                                          | Production crash/error visibility — notably absent from the old Flutter app                                             |
| Experimentation (paywall)     | RevenueCat Experiments                                          | Native to the billing layer already in use                                                                              |
| Experimentation (onboarding)  | Custom, backed by Mixpanel                                      | RevenueCat doesn't cover non-billing flows; a dedicated feature-flag SaaS is unnecessary scope for this size of project |
| Native iOS UI                 | `expo-glass-effect` (or `@callstack/liquid-glass`)              | Liquid Glass, iOS 26+                                                                                                   |
| Native Android UI             | Material 3 idioms (React Native Paper as the primitive library) | Platform-native rather than an imitation of iOS                                                                         |
| Hosting (marketing site only) | Vercel                                                          | No coach web app — see product spec, mobile-only                                                                        |
| Build/release                 | EAS Build, EAS Submit, EAS Update                               | Standard Expo toolchain                                                                                                 |

---

## 2. Project Setup & Repo Structure

Single Expo app repo for v1 — no monorepo, there's no second app to share code with yet.

```
app/                          # Expo Router file-based routes
  (onboarding)/
    welcome.tsx
    role.tsx
    challenge.tsx              # coach-path only
    _layout.tsx
  (auth)/
    sign-up.tsx
    log-in.tsx
  (tabs)/
    today/
    history/
    teams/
    settings/
    _layout.tsx                # tab bar — see Section 9 re: platform-specific chrome
  team/
    [id]/
      index.tsx                # Team Home
      athlete/[athleteId].tsx
      roster.tsx
      questions.tsx
      paywall.tsx
      locked.tsx                # explanatory lockout screen
components/
  ui/                          # shared, cross-platform primitives
  ui/glass/                    # iOS-only, Liquid Glass wrapped components
  ui/material/                 # Android-only, Material 3 wrapped components
  charts/                      # radar chart, line chart, body map — see Section 10
lib/
  supabase.ts
  revenuecat.ts
  mixpanel.ts
  sentry.ts
  notifications.ts
hooks/
  useAuth.ts
  useCoachAccess.ts             # trial/subscription status, see Section 6
  useTeam.ts
types/
  database.ts                  # generated from Supabase schema
constants/
  experiments.ts                # variant definitions, see Section 7
supabase/
  migrations/
  functions/
    revenuecat-webhook/
    send-trial-reminders/
    on-checkin-flag-check/
```

**Critical early setup step:** because Liquid Glass requires native code, **set up an EAS development build on day one**, not Expo Go. Standard Expo Go will not render the glass effects, and switching later means re-establishing the dev workflow mid-project. `eas build --profile development` should be the very first build run, before any real screens exist.

---

## 3. Data Model

Core tables (Postgres via Supabase). This is the shape, not exhaustive DDL — Claude Code should generate full migrations from this.

| Table                       | Key columns                                                                                                                         | Notes                                                                                                                                                                                                                                                                                                                                                                                                |
| --------------------------- | ----------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `profiles`                  | `id` (FK `auth.users`), `name`, `notification_time`                                                                                 | `theme` is deliberately **not** a column here — see note below. Billing fields are deliberately not here either — see `billing_status`                                                                                                                                                                                                                                                               |
| `billing_status`            | `profile_id` (FK `profiles`, PK), `trial_started_at`, `subscription_active`, `subscription_expires_at`, `revenuecat_customer_id`    | Trial and subscription status — **account-level, not per-team** (per confirmed decision). Split into its own table so it can be locked down at the RLS layer (Section 4): `profiles` needs a client-writable row for `name`/`notification_time` edits, and RLS enforces row-level access, not column-level — so billing state can't safely share a row with anything the client is allowed to update |
| `teams`                     | `id`, `name`, `sport`, `created_by` (FK `profiles`), `join_code` (unique), `created_at`                                             |                                                                                                                                                                                                                                                                                                                                                                                                      |
| `team_members`              | `id`, `team_id`, `profile_id`, `role` (`athlete` / `admin`), `consent_given_at`, `joined_at`                                        | `consent_given_at` enforces the mandatory consent screen at the data layer, not just UI                                                                                                                                                                                                                                                                                                              |
| `custom_questions`          | `id`, `team_id`, `question_text`, `type` (`scale` / `yes_no` / `text`), `required`, `sort_order`                                    | Max 2 per team enforced at the application layer (or a check constraint)                                                                                                                                                                                                                                                                                                                             |
| `daily_checkins`            | `id`, `profile_id`, `date`, `fatigue`, `sleep`, `muscle_soreness`, `stress`, `mood`, `availability`, `wellness_score`, `created_at` | **Not team-scoped** — one check-in per profile per day (`unique(profile_id, date)`), visible to _any_ team that profile belongs to. An athlete on two teams doesn't fill in the form twice.                                                                                                                                                                                                          |
| `custom_question_responses` | `id`, `checkin_id` (FK `daily_checkins`), `custom_question_id`, `response_value`                                                    | Links a day's check-in to a specific team's custom question answer                                                                                                                                                                                                                                                                                                                                   |
| `body_map_entries`          | `id`, `profile_id`, `date`, `location`, `severity`, `note`, `created_at`                                                            |                                                                                                                                                                                                                                                                                                                                                                                                      |
| `rpe_logs`                  | `id`, `profile_id`, `logged_at`, `rpe_value`, `note`                                                                                | Timestamp not just date — multiple sessions/day possible                                                                                                                                                                                                                                                                                                                                             |
| `notifications`             | `id`, `profile_id`, `type`, `title`, `body`, `read`, `related_team_id`, `created_at`                                                | In-app inbox, mirrors push                                                                                                                                                                                                                                                                                                                                                                           |

**Flagged list is computed, not stored** — a query (or Postgres view) joining recent `daily_checkins` against each athlete's own rolling baseline, plus recent `body_map_entries` and `rpe_logs` load trend, rather than a separately maintained table that could go stale.

**`theme` lives in local device storage only** (`expo-secure-store` or `AsyncStorage`), never in Supabase — it's a device preference, not account data worth syncing across a coach's devices for v1, and it's one less client-writable column that could ever be confused with something security-sensitive on `profiles`.

---

## 4. Row-Level Security & Access Control

This is where the coach/athlete visibility model (product spec, Section 8) actually gets enforced — in the database, not just hidden in the UI. **This matters specifically for the trial lockout too:** enforcing it in RLS means a locked-out coach's app genuinely can't fetch team data, rather than the app just choosing not to display it — a meaningfully more robust implementation than a client-side check alone.

**This also matters for `billing_status` itself.** `profiles` needs an update policy like `using (id = auth.uid())` so users can edit `name`/`notification_time` — but RLS policies are row-level, not column-level, so that same policy would just as happily let a client update _any_ column on their row, including a subscription flag, if billing fields lived there too. Keeping billing state in its own table sidesteps that: `billing_status` gets a `select` policy for its owner and **no** `insert`/`update`/`delete` policy for the `authenticated` role at all — the only writes come from the RevenueCat webhook and trial-start trigger, both running as `service_role`, which bypasses RLS by design.

```sql
-- billing_status: readable by its owner; no authenticated-role write policy exists, by design —
-- only service_role (webhook, trial-start trigger) can write to this table
alter table billing_status enable row level security;

create policy "read_own_billing_status"
on billing_status for select
using (profile_id = auth.uid());

-- Helper: does this profile currently have active coach access (trial or paid)?
create or replace function has_coach_access(p_profile_id uuid)
returns boolean as $$
  select exists (
    select 1 from billing_status
    where profile_id = p_profile_id
    and (
      (trial_started_at is not null and trial_started_at > now() - interval '7 days')
      or subscription_active = true
    )
  );
$$ language sql stable security definer;

-- Athletes always read their own check-ins
create policy "own_checkins_read"
on daily_checkins for select
using (profile_id = auth.uid());

-- Coaches read check-ins of athletes on teams they administer, only while they have access
create policy "coach_reads_team_checkins"
on daily_checkins for select
using (
  exists (
    select 1 from team_members tm_athlete
    join team_members tm_coach on tm_coach.team_id = tm_athlete.team_id
    where tm_athlete.profile_id = daily_checkins.profile_id
    and tm_coach.profile_id = auth.uid()
    and tm_coach.role = 'admin'
    and has_coach_access(auth.uid())
  )
);

-- Athletes never read another athlete's check-ins directly (no policy grants this — default deny)
```

Apply the same `has_coach_access()` gate to policies on `body_map_entries`, `rpe_logs`, `custom_questions`, and `custom_question_responses` for coach-side reads. `team_members` roster visibility (names, not wellness data) can be readable by any member of the same team regardless of subscription status — seeing who's on the team isn't the paid part, seeing their wellness data is.

---

## 5. Authentication

Supabase Auth, email/password + magic link (per product spec — no social login in v1). Deep link handling needed for: magic link callback, and team-invite links (`yourapp.com/join/[code]` opening directly into the join flow if the app is installed). Configure Supabase's email templates for the magic link and password reset early — default templates are unstyled and worth a pass.

---

## 6. Billing & Subscription Architecture

**RevenueCat setup:**

- One entitlement: `coach_access`
- Products: `coach_monthly`, `coach_annual`
- SDK: `react-native-purchases`, initialized with the RevenueCat API key on app start, `Purchases.logIn(supabaseUserId)` immediately after Supabase auth so RevenueCat and Supabase share the same user identity.

**Trial (database-tracked, not RevenueCat-native — per confirmed decision):**

- `billing_status.trial_started_at` set once, server-side (an Edge Function or a Postgres trigger on first `teams` insert by a given `created_by`), never client-set directly — prevents a device-clock manipulation trick from extending a trial. Because `billing_status` has no client write policy at all (Section 4), this isn't just a convention the app follows — the client is structurally unable to write to it, trigger discipline or not.
- `has_coach_access()` (Section 4) is the single source of truth the whole app checks — a `useCoachAccess()` hook wraps it client-side for UI state, but the _real_ enforcement is the RLS policy, not the hook.

**Real purchase flow:**

- Triggered only from the lockout/upgrade screen — `Purchases.purchasePackage()`.
- On success, RevenueCat fires a webhook → Supabase Edge Function `revenuecat-webhook` → updates `billing_status.subscription_active` and `subscription_expires_at`, writing via `service_role` (the one path that bypasses RLS and is meant to). Client also refreshes `customerInfo` on foreground to unlock immediately without waiting on the webhook round-trip.
- Handle `EXPIRATION` and `CANCELLATION` webhook events too, setting `subscription_active = false` — this is what re-triggers the lockout for a lapsed subscriber, not just first-time trial expiry.

**Settings screen needs a "Restore Purchases" button** calling `Purchases.restorePurchases()` — required by App Store review guidelines for any IAP app.

---

## 7. A/B Testing & Experimentation

**Paywall (price, headline framing, trial length):** RevenueCat Experiments, configured against the `coach_access` offering. The app fetches the active offering via `Purchases.getOfferings()` and renders price/package info from whatever variant RevenueCat serves — this is compatible with the dynamic headline text (which comes from the onboarding personalization answer, a separate concern) because the two aren't coupled: RevenueCat controls price/packaging, the app controls the surrounding copy.

**Onboarding (question order, quiz length, copy):** not covered by RevenueCat. For **v1**, only the short flow (product spec, Section 3) exists — there's no variant to branch to yet, so don't build variant-switching logic prematurely. What v1 _does_ need from day one is the **event tracking that makes a future comparison possible**:

Minimum Mixpanel event set:

- `onboarding_started`
- `role_selected` (property: `role`)
- `challenge_selected` (coach path, property: `challenge`)
- `signup_completed`
- `trial_started`
- `team_created`
- `checkin_completed` (property: `is_first_checkin`)
- `paywall_viewed`
- `purchase_completed`
- `trial_reminder_sent` (property: `channel`: push/email, `day`: 5/final)
- `flag_triggered` (property: `reason`)

Identify anonymously on first open (a locally generated UUID via `expo-secure-store`, `mixpanel.identify(anonId)`), then re-identify with the real Supabase user ID once they sign up (`mixpanel.alias()`), so the pre-signup funnel steps and post-signup behaviour connect into one person's timeline.

When Variant B (the extended quiz) gets built later, bucket assignment should be a deterministic hash of the anonymous ID stored in `constants/experiments.ts`-style config, not hardcoded per-screen logic — keeps it swappable without a release.

---

## 8. Push Notifications & Transactional Email

**Push:** `expo-notifications`, standard Expo push token registration on permission grant. Two triggers need server-side jobs, not just client logic:

1. **`send-trial-reminders`** (Supabase Edge Function, scheduled daily via `pg_cron`): queries `billing_status` (joined to `profiles` for name/contact info) for accounts at day 5 and at the final day of their trial, sends both a push (via Expo's push API) and an email (via Resend) — the two-channel redundancy specified in the product spec's "don't surprise them" section.
2. **`on-checkin-flag-check`** (Supabase Database Webhook, fired on insert to `daily_checkins` or `body_map_entries`): computes whether this new entry creates a flag against the athlete's baseline, and if so, pushes a notification to the relevant team's admin(s) near-real-time — this is what makes the flagged list feel responsive rather than something a coach has to remember to check.

**Email (Resend):** needs templates for the trial day-5 reminder and final-day reminder at minimum. Keep these plain and calm in tone, matching the in-app notification copy style from the product spec — same message, two channels, not two different tones.

---

## 9. Native Design System Implementation

**iOS — Liquid Glass:** `expo-glass-effect` as the primary choice. Applies specifically to: tab bar, sheets/modals (paywall, upgrade prompts), floating action button (RPE logging). **Requires iOS 26+ and a dev build — see Section 2.** Every glass surface needs a defined fallback for iOS <26 and for `AccessibilityInfo.isReduceTransparencyEnabled()` — a solid or lightly-tinted background, not a broken/transparent one.

**Android — Material 3:** React Native Paper as the component primitive library for Android-specific chrome (tab bar, buttons, sheets). Not used on iOS — iOS gets the glass treatment instead.

**Mechanism for platform divergence:** use React Native's platform-specific file extension convention (`TabBar.ios.tsx` / `TabBar.android.tsx`) for genuinely different chrome — tab bar, modals/sheets, the paywall screen's presentation. Everything else (forms, the check-in screen, charts, lists) stays as shared components with `Platform.select()` for minor styling differences only, rather than fully forked implementations — forking every component would be far more build time than the two platforms' visual differences actually warrant.

**General styling:** Use react native stylesheets for the ~90% of UI that isn't platform-specific chrome — forms, cards, layout, typography. Keep it out of the `ui/glass/` and `ui/material/` platform-specific component folders, where native primitives should drive the styling instead.

---

## 10. Charts & Custom Components — Real Scope Flag

Flagging honestly rather than letting this hide inside "just add a chart library," since it affects your time budget directly:

- **Line chart, calendar view:** well-served by existing libraries — `react-native-gifted-charts` for the line chart, `react-native-calendars` for the calendar. Low risk, standard integration.
- **Radar chart (wellness vs. baseline):** most RN chart libraries don't support polar/radar charts out of the box. This most likely needs a **custom implementation using `react-native-svg` directly** — a real, non-trivial task, not a config option on an existing library. If time is tight, a fallback worth considering is a set of horizontal bars (one per metric, current vs. baseline) instead of a true radar chart — less visually distinctive, meaningfully less build time. Worth deciding explicitly rather than discovering this mid-sprint.
- **Body map:** no off-the-shelf RN package fits an interactive tappable body outline well. This is **custom SVG work** — a body silhouette with defined tappable regions (paths/polygons per body area). Budget real time for this; it's one of the more bespoke pieces of UI in the app.

---

## 11. Analytics & Error Tracking

**Mixpanel:** the funnel events in Section 7, plus general usage events (`checkin_completed`, `rpe_logged`, `body_map_used`, `custom_question_added`, `member_invited`, `member_promoted`, `export_used`). Track on both iOS and Android consistently — don't let event names drift between platforms.

**Sentry:** standard RN/Expo integration (`@sentry/react-native`), source maps uploaded via EAS Build hooks so stack traces are readable, not minified. Set this up in Phase 1 (Section 15) — the old Flutter app had no crash reporting at all, worth not repeating that gap from day one this time.

---

## 12. Environment Config & EAS Build Profiles

`eas.json` with three profiles:

- **`development`** — dev client, internal distribution, used for local iteration (including Liquid Glass testing, which needs a real dev build as noted in Section 2).
- **`preview`** — internal distribution via TestFlight (iOS) / internal testing track (Android), used for the pilot coaches from the marketing plan's outreach — no public store listing needed for this stage.
- **`production`** — public App Store / Play Store release.

Secrets (Supabase URL/anon key, RevenueCat API key, Mixpanel token, Sentry DSN, Resend API key) via EAS's environment variable system per profile — never committed to the repo, and the anon key specifically relies on RLS (Section 4) actually being correct, since it's public by design.

---

## 13. Testing & QA Approach

Given the realistic time budget (10–15 hrs/week, solo), a full automated test suite is not the right investment for v1 — deliberately scoping this down rather than skipping it by accident:

- TypeScript strict mode + ESLint/Prettier as automated, cheap-to-maintain guardrails.
- Sentry catching what slips through in production (Section 11).
- A short manual smoke-test checklist run before each `preview`/`production` build — covering the core paths (sign up → check-in → create team → trial → lockout → purchase → roster/consent), not exhaustive automated coverage.
- Revisit real automated testing once there's a second contributor or real subscriber volume to protect — not a v1 concern.

---

## 14. CI/CD

A single, lightweight GitHub Actions workflow: typecheck + lint on every pull request. Nothing more elaborate — `eas build` itself is triggered manually or via the EAS CLI, not a complex multi-stage pipeline that isn't needed at this scale.

---

## 15. Suggested Build Sequence

1. **Foundation:** Expo project, EAS dev build working (Liquid Glass smoke test), Supabase project + schema + RLS, Sentry + Mixpanel wired, Auth working end to end.
2. **Athlete core (the always-free part):** daily check-in, conditional body map, RPE logging, personal history/radar chart.
3. **Coach core:** teams, roster, custom questions, Team Home with flagged list, athlete detail.
4. **Billing:** RevenueCat integration, database-tracked trial, lockout screen, webhook, restore purchases.
5. **Onboarding + notifications:** the short personalization flow, push + email trial reminders, flag-triggered pushes.
6. **Native polish:** Liquid Glass / Material 3 pass, accessibility pass, offline handling, empty/error states.
7. **Pilot distribution:** `preview` build to the pilot coaches identified in the marketing plan, iterate on real feedback.
8. **Public release:** `production` build, App Store / Play Store submission.

Steps 2 and 3 can run roughly in parallel if useful, since they touch different screens; billing (4) genuinely depends on both existing first, since the lockout has to gate something real.

---
