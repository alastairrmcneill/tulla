# Coding Plan — Tulla

**Depends on:** `01-product-spec.md` (what) and `02-technical-implementation-plan.md` (how). A ticket's **References** line names the sections it draws on — only fetch those if the ticket's own spec isn't enough, don't re-read either document wholesale per session.

## How this works

- Read **this file**, then **only the current epic's `plan/epic-N.md`** — not the whole plan tree. That's the full per-session read.
- Each epic is a separate file under `plan/`. Work through epics in order; within an epic, work through tickets in order. A ticket never depends on a later ticket or a later epic — if you think it does, the plan is wrong, flag it rather than stubbing around it.
- One ticket = one commit/PR-sized chunk: implement it, stop, show the diff, wait for approval, commit (referencing the ticket number), tick it `[x]`, move on. Never batch tickets into one commit, never start a later ticket before the current one is done or explicitly deferred.
- Status markers: `[ ]` todo · `[~]` in progress · `[x]` done · `[!]` blocked/deferred (reason noted inline).
- Every ticket's **Done when** is split into *machine-checkable* (you can verify it yourself — typecheck, a query returns X, an RLS test denies/allows correctly) and *device-checkable* (needs a real device/simulator run or human judgment — VoiceOver pass, a sandbox purchase, airplane-mode toggle). Clear every machine-checkable item yourself; don't stall waiting for a device pass that isn't yours to run — flag it as the remaining step and move to the next ticket only once told to.
- Tablet layouts are built together with phone, in the same ticket — most screens are just the phone layout at a wider centred width (`layout.maxContentWidth`); only Team Home (4.5) gets a genuine split-view.
- Accessibility criteria are inline per screen ticket. Epic 7 carries only the final cross-cutting sweep for what inline review can't catch.
- No hour estimates — scope and acceptance criteria only.
- `design-reference/Wellness App.dc.html` (dark, default) / `Wellness App Light.dc.html` (light) / `Wellness App Tablet.dc.html` (tablet) at the repo root — grep the `sc-if value="{{ onX }}"` flag named in a ticket to jump to that screen's exact markup/values.

## Epics

| # | Epic | Status |
|---|------|--------|
| 0 | Design System & Theme Foundation | done — [`HISTORY.md`](HISTORY.md) |
| 1 | Foundation | done — [`HISTORY.md`](HISTORY.md) |
| 2 | [Shared Data & Notification Infrastructure](plan/epic-2.md) | not started |
| 3 | [Athlete Core](plan/epic-3.md) | not started |
| 4 | [Teams & Coaching](plan/epic-4.md) | not started |
| 5 | [Billing & Subscriptions](plan/epic-5.md) | not started |
| 6 | [Onboarding & Account](plan/epic-6.md) | not started |
| 7 | [Native Polish](plan/epic-7.md) | not started |
| 8 | [Pilot Distribution](plan/epic-8.md) | not started |
| 9 | [Public Release](plan/epic-9.md) | not started |

**Next up:** Epic 2, ticket 2.2.

## Locked technical decisions (quick reference — full detail lives in the owning ticket)

| Decision | Value | Owning ticket |
|---|---|---|
| Personal baseline window | Lagged 14-day (t−14…t−1), min coverage 10/14, SD floor 0.5; secondary 28-day drift reference, min coverage 20/28 | 3.1 |
| History chart trend line | Separate calc from baseline — trailing 14-day average *including* today | 3.1, 3.8 |
| `wellness_score` formula | `(avg of 5 metrics − 1) / 4 × 100` | 3.4 |
| Body map regions | Coarse: head/neck, shoulder L/R, arm L/R, chest, abdomen, leg L/R (front); neck, upper back, lower back, arm L/R, leg L/R (back) | 3.3 |
| Flagged-list ranking | Priority bucket (pain > below-baseline > rising load) then magnitude within bucket | 4.4 |
| "Meaningful pain" threshold | Any `moderate`/`severe` body-map entry today; `mild` alone doesn't flag | 4.4 |
| Trial length | Config-driven, deterministic hash: `control`=7 days, `variant_b`=5 days, 50/50 | 4.1 |
| Trial reminder milestones | `trial_length_days − 2` and `trial_length_days` (generalizes spec's "day 5 of 7") | 6.9 |
| Consent gates coach reads | Yes — coach-read RLS policies require `consent_given_at is not null` | 4.11 |
| Shared read/cache layer | TanStack Query, persisted to `AsyncStorage` | 2.2 |
| Account deletion | Hard delete on request (no anonymization) | 6.11 |
| RevenueCat pricing | **Still open** — placeholder/sandbox pricing through Epic 5, real pricing required before 9.3 | 5.2 → 9.3 |
| Deep links | Custom scheme (`tulla://`) for v1; universal links deferred to a marketing-site domain existing | 9.4 |
