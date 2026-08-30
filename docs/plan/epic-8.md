# Epic 8 — Pilot Distribution

### 8.1 — `preview` build + store internal tracks `[ ]`

**Depends on:** 1.3, all of Epics 3–7.
**References:** tech plan §12, §15 step 7.
**Spec:** finalize the `preview` EAS profile, submit to TestFlight (iOS) and the Play Store internal testing track (Android) — no public listing needed at this stage.
**Done when — device-checkable:** a pilot coach can install via TestFlight/internal-testing link and reach a working sign-up.

### 8.2 — Manual smoke-test checklist `[ ]`

**Depends on:** all of Epics 3–5 (write it once real paths exist).
**References:** tech plan §13.
**Spec:** a checklist document (`docs/SMOKE_TEST.md`) enumerating each step of the core path — sign up → check-in → create team → trial → lockout → purchase → roster/consent — with a pass/fail line, run before this build and every subsequent `preview`/`production` build.
**Done when — machine-checkable:** the checklist exists and has been run at least once against 8.1's build with all steps passing.

### 8.3 — Pilot coach access `[ ]`

**Depends on:** 8.1.
**References:** marketing plan (background only).
**Spec:** confirm pilot coaches from the marketing plan can get from a TestFlight/internal-testing invite to a working account with no unexplained friction; set up a feedback channel (shared form/email is enough).
**Done when — device-checkable:** at least one real external pilot coach has created a team and gotten at least one athlete through consent + a check-in.

### 8.4 — Pilot feedback iteration `[ ]`

**Depends on:** 8.3.
**References:** tech plan §15 step 7.
**Spec:** open-ended — feed real pilot feedback into new tasks appended to whichever epic they belong to, keeping `CODING_PLAN.md` + `plan/` the single source of truth, no parallel untracked backlog.
**Done when:** N/A — ongoing, closed out by mutual agreement once pilot feedback stops producing material changes.
