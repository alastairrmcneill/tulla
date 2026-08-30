# Epic 4 — Teams & Coaching

The paid product surface, built so every screen is real on first pass — trial-gating and its client hook land before anything that displays gated state, so Team Home never needs a stubbed banner or reminder button.

### 4.1 — Trial start trigger `[ ]`

**Depends on:** 1.6, 1.7.
**References:** tech plan §6 ("`trial_started_at` set once, server-side... never client-set"), §7.
**Spec:**
- Postgres trigger, `after insert on teams`, function `start_trial_for_creator()`: for the inserting row's `created_by` profile, if that profile has no `billing_status` row yet, insert one with `trial_started_at = now()` and `trial_length_days` resolved server-side (below). If a `billing_status` row already exists (mid-trial, expired, or subscribed), do nothing — a second team never resets or extends a trial.
- `trial_length_days` resolution, entirely server-side: `case when abs(hashtext(created_by::text)) % 2 = 0 then 7 else 5 end` — deterministic 50/50 split, `control`=7 days, `variant_b`=5 days. The trigger computes this itself; no client-supplied day-count is ever trusted.
- `constants/experiments.ts` (client): `{ control: 7, variant_b: 5 }` — read-only mirror for display/analytics labeling, not a source of truth.
- `has_coach_access()` (1.7) already reads `trial_length_days` from the row — confirm this in this ticket, don't let it regress to a hardcoded `interval '7 days'`.

**Done when — machine-checkable:** inserting a team for a profile with no `billing_status` row creates one with `trial_started_at` set and `trial_length_days` ∈ {5,7}; inserting a second team for an already-trialing or subscribed profile leaves the existing row untouched; two seeded profile ids chosen to hash to each branch confirm both variants are reachable.

### 4.2 — `useCoachAccess()` hook + `team_has_access()` `[ ]`

**Depends on:** 4.1, 2.2.
**References:** tech plan §6 ("a `useCoachAccess()` hook wraps it client-side for UI state, but the real enforcement is the RLS policy").
**Spec:**
- SQL function `team_has_access(p_team_id uuid) returns boolean` — `has_coach_access()` (1.7) applied to that team's admin member's `profile_id`. Used everywhere "is this team's coach access active" needs checking (4.5's banner logic, 4.8's question visibility, 4.10's locked notice) — one function, not reimplemented per screen.
- `hooks/useCoachAccess.ts` — reads the current user's own `billing_status` via 2.2's query hook, returns `{ hasAccess: boolean, daysRemaining: number | null, isTrial: boolean }`. `daysRemaining = max(0, trial_length_days - days since trial_started_at)`, `null` once `subscription_active`. Purely UI state — RLS is the enforcement layer.

**Done when — machine-checkable:** hook returns correct values against three fixture `billing_status` rows (mid-trial, expired-trial, active-subscription); `team_has_access()` returns correct booleans for a team with an active-trial admin vs. an expired-trial admin.

### 4.3 — Create Team screen `[ ]`

**Depends on:** 1.9, 1.13, 4.1.
**References:** product spec §6.5, screen 9.
**Spec:** Name (required), sport tag (optional). On submit: generate a unique `join_code` (retry on collision), insert `teams` row, insert `team_members` row for the creator as `admin`. Trial start happens automatically via 4.1's trigger — this screen makes no trial-related call itself. Navigates to Team Home (4.5) on success.
**Done when — machine-checkable:** creates a valid `teams`/`team_members` pair with a unique `join_code`; the corresponding `billing_status` row exists afterward with no explicit client write to it.

### 4.4 — Flagged-list computation `[ ]`

**Depends on:** 1.6, 1.7, 3.1.
**References:** tech plan §3; product spec §6.6 item 2.
**Spec:**
- Postgres function `team_flagged_athletes(p_team_id uuid)`, RLS-gated through `has_coach_access()`. Per athlete on the team, compute independently:
  - **`pain_reported`**: a `body_map_entries` row today with `severity` in `(moderate, severe)` — a single `mild` entry alone does not flag.
  - **`below_baseline`**: any of today's 5 metrics where `athlete_baseline_14.sufficient = true` and z-score ≤ -1.5; report the most-deviated metric as the reason detail.
  - **`rising_load`**: this week's summed `rpe_value` >10% higher than last week's — same rule 3.8 uses for its trend arrow.
- Severity ranking (sort order): priority bucket first — `pain_reported` (severe before moderate) > `below_baseline` > `rising_load` — then, within a bucket, sort by magnitude descending (larger `|z|`, larger % load increase). An athlete with multiple reasons sorts by their highest-priority reason; all applicable reasons render as chips on their row.
- Reuses 3.1's `athlete_baseline_14` directly — no separate baseline calculation.
- Each reason expressible as short text/icon, never colour alone (feeds 4.5's chip requirement).

**Done when — machine-checkable:** a seeded team with a mix of normal/flagged athletes returns the right athletes, correct distinct reasons, correct priority-then-magnitude order; querying with `has_coach_access()` false for that team's admin returns nothing.

### 4.5 — Team Home screen (phone + tablet) `[ ]`

**Depends on:** 1.13, 4.2, 4.3, 4.4, 2.2, 2.3.
**References:** product spec §6.6 in full, §4 (tablet split-view spec: 35/65).
**Spec:** all five sections real on first build, no stubs:
1. Trial/subscription banner — `useCoachAccess()` (4.2): "Free trial: N days left," or nothing for an active subscription or an additional team under one.
2. Flagged list (4.4) — row: name, reason chip(s), tap → Athlete Detail (4.6).
3. "Today's completion" — "N of M checked in today" (`team_members` count vs. distinct `daily_checkins` today via the roster join); tap to see who's missing; one-tap "send reminder" push per missing athlete via 2.3's `sendPush()` — real from first build.
4. Team wellness trend — small chart, team average `wellness_score` over the last 2 weeks vs. team baseline (average of members' `athlete_baseline_14` means), reusing 3.8's chart approach, team-aggregated.
5. "See all responses" → 4.9.
- Tablet: flagged-list + athlete-detail as a genuine split view (left ~35%, right ~65%) at the standard tablet breakpoint; items 1/3/4 stay full-width above it.
- Empty state: "Waiting on your first check-ins" — distinct from a team with data but nobody currently flagged.

**Done when — machine-checkable:** all five sections render against seeded data on phone and tablet fixture widths; empty-team state is visibly distinct from nothing-flagged state.
**Done when — device-checkable:** the reminder-send button delivers a real push (pairs with 2.3's device check).

### 4.6 — Athlete Detail screen `[ ]`

**Depends on:** 3.2, 4.5.
**References:** product spec §6.7.
**Spec:** radar chart (3.2, that athlete's data + `athlete_baseline_14`), personal history line chart (3.8's approach), recent body-map reports, RPE/load history, custom question answers (queries `custom_question_responses` — legitimately empty until 4.8 lands, not a stub). Entirely read-only from the coach's side.
**Done when — machine-checkable:** renders identically as a full-screen phone route and as the tablet split-view's right pane — same component, different container.

### 4.7 — Roster / Invite screen `[ ]`

**Depends on:** 1.7, 4.3.
**References:** product spec §6.8.
**Spec:**
- Join code display with native share-sheet button (`expo-sharing`/`Share`).
- Member list with role indicator, "promote to admin" / "remove" per member.
- RLS addition (1.7 only covered `team_members` select-visibility): `team_members` `update`/`delete` policy — allowed only when the requester is an `admin` member of the same `team_id`. Migration lands in this ticket.

**Done when — machine-checkable:** RLS test confirms a non-admin's direct `update`/`delete` on another member's `team_members` row is denied.
**Done when — device-checkable:** invite share sheet opens with a working join-code payload; promote/remove work for an admin.

### 4.8 — Custom Questions setup + check-in wiring `[ ]`

**Depends on:** 1.6, 4.3, 3.4, 4.2.
**References:** product spec §6.9; tech plan §3 (max-2 enforcement, already a trigger from 1.6).
**Spec:**
- Setup screen: up to 2 questions per team, text/type(`scale`/`yes_no`/`text`)/required toggle, live preview of check-in rendering.
- Same ticket wires 3.4's check-in screen: query `custom_questions` for each team the athlete belongs to where `team_has_access(team_id)` (4.2) is true, render under a "Questions from your coach" divider; teams without access render no questions section. Writes to `custom_question_responses` linked via `checkin_id`.

**Done when — machine-checkable:** creating/editing/deleting a question here is reflected live in the check-in screen (via 2.2 query invalidation) for a team member; a 3rd-question attempt surfaces the trigger's error clearly in the UI, not a silent failure; a locked team's questions don't appear on check-in without any further ticket needed.

### 4.9 — All Responses screen `[ ]`

**Depends on:** 1.7, 4.5.
**References:** product spec screen 17, referenced from §6.6 item 5.
**Spec:** raw per-athlete list of check-in responses for the team, RLS-gated the same as the rest of coach-side reads.
**Done when — machine-checkable:** reachable from Team Home's "See all responses," shows real per-athlete rows, respects `has_coach_access()`.

### 4.10 — Team Info screen (athlete, read-only) `[ ]`

**Depends on:** 1.7, 4.3, 4.2.
**References:** product spec §4, §7 (locked-team notice copy, verbatim).
**Spec:** read-only team view for a member who isn't that team's admin. Locked notice, exact copy: _"Your coach's trial has ended — your check-ins still work, but they won't be shared with the team until they resubscribe"_ — shown when `team_has_access(team_id)` (4.2) is false.
**Done when — machine-checkable:** a member of a locked team sees the notice; a member of an active team doesn't; the member's own check-in submission (3.4) is confirmed unaffected either way.

### 4.11 — Join Team + Consent flow `[ ]`

**Depends on:** 1.7, 1.8, 4.3.
**References:** product spec §6.10 in full, exact consent copy template.
**Spec:**
- Join-code entry screen **and** arrival via `tulla://join/[code]` (1.8's scheme-routing pattern) — both converge on the same consent screen.
- Consent screen: team name, coach's name, exact copy from spec §6.10 with `[Coach Name]`/`[Team Name]` interpolated. "Join team" (primary, writes `team_members.consent_given_at = now()`) / "Not now."
- One-time per team — an already-consented member re-arriving via an old link skips straight past.
- RLS migration in this ticket: extend every coach-read policy from 1.7 (`daily_checkins`, `body_map_entries`, `rpe_logs`, `custom_questions`, `custom_question_responses`) with `and team_members.consent_given_at is not null` on the athlete's `team_members` row — closes the gap where the literal tech-plan SQL allowed a coach to read a non-consenting member's data via a direct query, against product spec §8's explicit requirement.

**Done when — machine-checkable:** RLS test confirms a team member without consent given is not readable by that team's coach even via a direct query bypassing the UI; declining leaves no `team_members` row; accepting sets `consent_given_at` and an immediately-submitted check-in becomes visible to the coach.
**Done when — device-checkable:** both entry paths (manual code, deep link) reach the same consent screen with correct interpolated names.
