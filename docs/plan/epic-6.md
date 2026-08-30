# Epic 6 — Onboarding & Account

### 6.1 — Onboarding flow shell `[ ]`

**Depends on:** 1.13.
**References:** product spec §3, §10 ("every screen and copy string in the onboarding/paywall flow should be pulled from config").
**Spec:** `(onboarding)/` route group with a config-driven screen sequence (ordered list of screen configs, not a hardcoded chain of `router.push` calls) so a future variant (spec §10's quiz-vs-no-quiz test) can reorder/skip screens via config alone.
**Done when — machine-checkable:** the full 10-step sequence from spec §3 navigates end to end using placeholder content, driven by the config structure.

### 6.2 — Welcome screen `[ ]`

**Depends on:** 6.1.
**References:** product spec §3 step 1; `design-reference` `onWelcome` block (exact copy — "Know how you'll train before you turn up," etc — use verbatim).
**Spec:** single strong statement + "Get started" CTA, no sign-up yet.
**Done when — machine-checkable:** matches `design-reference` copy exactly, dark + light.

### 6.3 — Personalization quiz `[ ]`

**Depends on:** 6.1.
**References:** product spec §3 steps 2–4 in full; `design-reference` `onQuiz` block.
**Spec:**
- Q1 role branch (track my own wellness / coach a team / both) — branches subsequent questions, doesn't hard-lock anything later.
- Athlete-leaning path: sport (short list + "Other"), training frequency buckets, single-select goal.
- Coach-leaning path: sport, squad size buckets (1–8 / 9–15 / 16–25 / 25+), challenge question (single-select, 4 options: *Spotting fatigue before it's a problem* / *Deciding who plays each session* / *Getting athletes to actually engage* / *Something else*) — persist this answer in onboarding-answers state carried through sign-up (6.6) to the paywall (6.7), not discarded after this screen.
- Market-research question (either path): current tracking method (Nothing / Spreadsheet / WhatsApp or texts / Another app) — captured to Mixpanel (6.8) regardless of downstream outcome.
- Variant-assignment plumbing wired now (deterministic hash of the anon id, `constants/experiments.ts`) even though v1 has one variant — exposure event fires regardless.

**Done when — machine-checkable:** both branches complete correctly; the challenge answer is readable downstream by 6.7; an exposure event fires with the single defined variant.

### 6.4 — Personalizing transition screen `[ ]`

**Depends on:** 6.3.
**References:** product spec §3 step 5; `design-reference` `onPersonalizing` block.
**Spec:** brief animated/loading moment, reuses `design-reference`'s spinner + rotating status-line copy pattern, transitions automatically (not user-dismissed) into 6.5.
**Done when — machine-checkable:** transitions automatically after `design-reference`'s timing.

### 6.5 — Value preview screen `[ ]`

**Depends on:** 3.2, 4.5, 6.3.
**References:** product spec §3 step 6; `design-reference` `onPreview` block.
**Spec:**
- Coach path: mocked flagged-list entry relevant to the Q3 challenge answer (6.3) — fixture data, reusing 4.5's flagged-row visual style, explicitly labelled "not real data."
- Athlete path: mocked radar/history preview using 3.2's `RadarChart` with fixture data.

**Done when — machine-checkable:** both paths render with fixture data that reflects the specific upstream answers, not one static example.

### 6.6 — Sign-up screen (onboarding-framed) `[ ]`

**Depends on:** 1.9, 6.5.
**References:** product spec §3 step 7 ("framed as 'save your setup'").
**Spec:** the onboarding flow's sign-up step, built directly in this framing (not a restyle of a separately-shipped screen — 1.9's `hooks/useAuth.ts` and sign-up logic are reused as-is, only the presentation is new here). 1.9's plain `(auth)/log-in.tsx` stays as the separate route for a returning user opening the app fresh (not part of the onboarding sequence).
**Done when — machine-checkable:** completing onboarding through this screen produces a real authenticated session and carries the onboarding answers forward (role/challenge/etc — needed by 6.7's dynamic headline and by team-creation defaults).

### 6.7 — Coach paywall screen + dynamic headline `[ ]`

**Depends on:** 6.3, 6.6, 4.3.
**References:** product spec §3 step 8, screen 8.
**Spec:**
- Coach-path-only screen, shown after sign-up (6.6), before team creation. Athlete-only path skips straight to the Today tab.
- Headline maps the Q3 challenge answer (6.3) to fixed copy, sourced from `constants/experiments.ts`-style config:
  - *Spotting fatigue before it's a problem* → "Catch fatigue on your team before it becomes a problem"
  - *Deciding who plays each session* → "Know who's ready before you name the team"
  - *Getting athletes to actually engage* → "The check-in athletes actually do"
  - *Something else* → "See how your whole team is really doing"
- Single CTA: "Start your free 7-day trial" (or the assigned variant's length, from 4.1's config) — this CTA does not itself call any billing API; it navigates to 4.3's Create Team screen, whose insert is what fires 4.1's trigger. No RevenueCat/IAP involvement on this screen — that's 5.4's job, at trial expiry only.
- No card, no payment info.

**Done when — machine-checkable:** each of the four challenge answers produces its correct distinct headline; the CTA reaches 4.3's Create Team screen and a real trial is running afterward (4.1's trigger fired).

### 6.8 — Mixpanel funnel events `[ ]`

**Depends on:** 1.11, 6.3, 6.6.
**References:** tech plan §7's full event list.
**Spec:** fire, at the correct point across Epics 3–6's already-built flows: `onboarding_started`, `role_selected` (`role`), `challenge_selected` (`challenge`, coach path), `signup_completed`, `trial_started` (include `trial_variant` property from 4.1's assignment), `team_created`, `checkin_completed` (`is_first_checkin`), `paywall_viewed`, `purchase_completed`, `trial_reminder_sent` (`channel`, `day`), `flag_triggered` (`reason`). This is a wiring task across many existing screens, not new UI.
**Done when — device-checkable:** a full manual run-through (onboarding → signup → team → check-in → paywall → purchase) produces the complete event sequence in Mixpanel, verified via the Mixpanel MCP, attributed to one identity throughout (anon → `alias()` → named events).

### 6.9 — `send-trial-reminders` Edge Function + email templates `[ ]`

**Depends on:** 4.1, 2.3.
**References:** tech plan §8 item 1; product spec §9.
**Spec:**
- Supabase Edge Function, scheduled daily via `pg_cron`. Milestones generalized from spec's "day 5 of 7" to work across 4.1's variable `trial_length_days`: fires once at `trial_length_days - 2` days elapsed, and once at `trial_length_days` days elapsed (final day) — a 7-day trial fires at day 5 and day 7, a 5-day trial at day 3 and day 5. Sends both a push (via 2.3's `sendPush()`) and a Resend email, per profile, per milestone — never re-fires the same milestone twice for the same trial.
- Resend templates: trial-approaching and trial-final-day, matching the in-app/push copy tone from spec §9 — plain and calm, same message as the push, not a separate marketing tone.

**Done when — machine-checkable:** a test `billing_status` row manually backdated to each milestone triggers exactly one push + one email per milestone, and re-running the function the same day doesn't re-send.

### 6.10 — `on-checkin-flag-check` Edge Function `[ ]`

**Depends on:** 4.4, 2.3.
**References:** tech plan §8 item 2; product spec §9.
**Spec:** Supabase Database Webhook on insert to `daily_checkins` or `body_map_entries`, computes whether the new entry creates a flag against 4.4's logic, if so pushes near-real-time (via 2.3's `sendPush()`) to the team's admin(s). This is the real implementation behind 4.5's reminder-push pattern and product spec §9's "flag triggered" copy.
**Done when — device-checkable:** submitting a check-in that crosses into flagged status produces a push to the team's admin within a few seconds.

### 6.11 — Settings & Account screen `[ ]`

**Depends on:** 1.9, 5.1, 5.4, 0.2.
**References:** product spec §6.12; tech plan §3 (`theme` device-local, never synced).
**Spec:**
- Theme toggle wired to `ThemeProvider.setMode` (0.2), persisted via `expo-secure-store`, never a `profiles` column.
- Notification time preference (writes `profiles.notification_time`).
- "Restore Purchases" button calling `Purchases.restorePurchases()` (5.1's SDK) — built directly here, no earlier placeholder needed.
- Account details, change password.
- Delete account: confirmation dialog stating the action is permanent, then **hard delete** — removes the `auth.users` row (cascading to `profiles` and all owned rows: `billing_status`, `team_members`, `daily_checkins`, `custom_question_responses`, `body_map_entries`, `rpe_logs`, `notifications`) via a `service_role` Edge Function (client can't self-delete `auth.users`). Teams the user administers: if they're the sole admin, the team and its remaining data stay intact but ownerless (no cascade-delete of a whole team's history over one admin's departure) — reassignment/orphaned-team handling is out of scope for v1.
- Privacy policy / terms: static in-app screen with a short, honest draft policy (states hard-delete-on-request, no third-party data sale) marked "draft — final version before public release" — swapped for real legal copy in Epic 9.
- Log out.

**Done when — machine-checkable:** theme choice persists across app restarts without touching Supabase; delete-account removes the `auth.users` row and confirms cascade on the listed tables via a post-delete query returning zero rows for that profile id.
**Done when — device-checkable:** Restore Purchases re-unlocks access on a fresh install with a prior sandbox purchase.
