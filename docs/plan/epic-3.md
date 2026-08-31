# Epic 3 — Athlete Core (always-free)

The free, no-team-required side of the product. Product spec §1: individual tracking is free forever — nothing here gates behind `has_coach_access()`.

### 3.1 — Personal baseline computation `[x]`

**Depends on:** 1.6.
**References:** product spec §6.1, §6.4; tech plan §3 ("flagged list is computed, not stored" — same principle applies here).
**Spec:**
- Postgres function `rolling_baseline(p_profile_id uuid, p_metric text, p_window_days int, p_min_coverage int, p_as_of date default current_date)` returning `(mean numeric, sd numeric, coverage int, sufficient boolean)`. `p_metric` one of `fatigue|sleep|muscle_soreness|stress|mood`.
  - Window is **lagged**: `date >= p_as_of - p_window_days and date <= p_as_of - 1` — excludes the day being compared, so today's value never contributes to its own baseline.
  - `coverage` = count of distinct dates with a `daily_checkins` row in that window. `sufficient = coverage >= p_min_coverage`.
  - `sd` floored at `0.5`: `greatest(stddev_samp(value), 0.5)`. When `sufficient` is false, `mean`/`sd` are returned `null` — callers must render an "insufficient data yet" state, never treat a null as zero deviation.
  - v1 does not exclude illness/injury-flagged days from the window — no such flag exists in the schema; known limitation, not a blocker for this ticket.
- Two fixed callers on top of the generic function:
  - `athlete_baseline_14(profile_id, as_of)` → `rolling_baseline(..., window_days=14, min_coverage=10)`. This is **the** comparison baseline — used for today's z-score, the radar chart's baseline polygon (3.2), and reused as-is by the coach flagged-list (4.4). One calculation, three consumers.
  - `athlete_baseline_28(profile_id, as_of)` → `rolling_baseline(..., window_days=28, min_coverage=20)`. Secondary drift reference. This ticket computes and exposes it only — no UI or flag logic consumes it yet.
- z-score for a given day's metric value: `(value - mean_14) / sd_14`, computed by the caller, not this function.
- **Separate calculation, do not conflate:** the History screen's smoothed trend line (3.8) is a plain trailing 14-day average **including** the current day — a display-smoothing calc, distinct from `athlete_baseline_14`. Reusing one for the other reintroduces the attenuation bug this ticket exists to avoid.

**Done when — machine-checkable:** seeded profile with 20+ days of check-ins returns correct `mean`/`sd`/`coverage`/`sufficient` from `athlete_baseline_14`; a profile with <10 days in the trailing 14 returns `sufficient=false` and null `mean`/`sd`; seeding 14 identical values confirms `sd=0.5` (floor), not `0`.

### 3.2 — Radar chart component `[x]`

**Depends on:** 0.1, 3.1.
**References:** tech plan §10 (custom `react-native-svg` build, no library support for polar/radar charts); `design-reference/Wellness App.dc.html`'s `onPreview` block for exact geometry/style reference.
**Spec:**
- `components/charts/RadarChart.tsx` — `react-native-svg` polygon plot, one axis per metric (fatigue/sleep/soreness/stress/mood), two overlaid polygons: current value vs. `athlete_baseline_14`'s `mean` per axis.
- Colours from `colors.accent`/`colors.status.*` tokens, never hardcoded hex.
- Plain numeric props (`current: Record<Metric, number>`, `baseline: Record<Metric, number | null>`) — no query coupling, so 4.6's coach-side reuse just passes different data.
- When a given axis's baseline is `null` (insufficient data per 3.1), render that axis's baseline vertex at the current-value point (i.e. no visible deviation) and surface "Baseline still building" in the accessible summary for that axis, rather than plotting a misleading zero.
- Accessible summary per axis for VoiceOver/TalkBack: e.g. "Fatigue 4 of 5, baseline 3.2" (or "Fatigue 4 of 5, baseline still building").

**Done when — machine-checkable:** renders correctly with fixture data at both phone and tablet widths, including the insufficient-baseline fixture case.
**Done when — device-checkable:** a VoiceOver pass reads out real per-axis values, not just "image."

### 3.3 — Body map SVG component `[x]`

**Depends on:** 0.1.
**References:** tech plan §10 (custom SVG, no off-the-shelf package); product spec §6.2.
**Spec:**
- `components/charts/BodyMap.tsx` — front/back silhouette as `react-native-svg` paths, front/back toggle.
- Tappable regions, coarse granularity, L/R distinct where applicable:
  - **Front:** head/neck, shoulder (L), shoulder (R), arm (L), arm (R), chest, abdomen, leg (L), leg (R).
  - **Back:** neck, upper back, lower back, arm (L), arm (R), leg (L), leg (R).
- Tap opens a severity picker sheet (mild/moderate/severe) + optional one-line note, built in this ticket. Screen-level wiring (trigger conditions, "something hurts?" entry point) is 3.6.
- Each region: accessible label, reachable via VoiceOver/TalkBack region-by-region navigation, not solely gesture-dependent.

**Done when — machine-checkable:** every defined region is tappable, opens the severity picker, and a confirm writes a `body_map_entries` row with the correct `location` value.
**Done when — device-checkable:** a screen-reader pass can identify and select a region without sighted tapping.

### 3.4 — Daily check-in screen (Today tab) `[x]`

**Depends on:** 1.13, 2.1.
**References:** product spec §6.1 in full; `design-reference` `onQuiz`-adjacent scale-picker visual style (reuse it, don't invent a second pattern).
**Spec:**
- Single scrolling screen, all questions visible, no wizard.
- Fatigue/sleep/soreness/stress/mood: 1–5 labelled scale. Fatigue labels verbatim: "Always tired" → "Very fresh". Get the other four metrics' label wording from `design-reference`'s `Question` model copy.
- Availability: 3-point smiley-icon pattern (reduced / available / fully available).
- No custom-questions section in this ticket — that slot is added directly onto this screen in 4.8, once a real team + custom questions exist to render, instead of shipping an empty placeholder now.
- Submit disabled until all five core scales + availability are answered.
- `wellness_score`: average of the five 1–5 metrics, normalized to 0–100 via `(avg - 1) / 4 * 100`.
- Picking `muscle_soreness` 1 or 2 — the value itself, not the eventual submit — opens 3.3's `BodyMap` in a bottom sheet over this same screen (revised from product spec §6.2's literal "immediately show the body map screen": the user's call, confirmed during 3.4 — a same-screen sheet, not a separate route, so the athlete never leaves the check-in mid-flow). 3.6's manual "something hurts?" entry point reuses the same sheet.
- On submit: write via 2.1's offline queue, then straight to 3.5's done state — no branch here anymore, since the body-map path is no longer submit-triggered.
- Full VoiceOver/TalkBack labels and values on every scale/picker; minimum platform tap target size on every option.
- Also built (design-reference fidelity, confirmed with the user): the ⓘ info button per scale row, opening a sheet with the full question + all 5 worded responses, each tappable as an alternate input path.

**Done when — machine-checkable:** submit is blocked until all core questions answered; `wellness_score` computed correctly against known fixture inputs; picking soreness 1 or 2 opens the body-map sheet, picking 3+ does not.
**Done when — device-checkable:** a full check-in submits offline and online; a screen-reader user completes the entire form using only VoiceOver/TalkBack.

### 3.5 — "Done for today" state `[ ]`

**Depends on:** 3.2, 3.4.
**References:** product spec §6.1.
**Spec:** replaces the check-in form on the Today tab once a `daily_checkins` row exists for this profile for today (query via 2.2's hook) — today's values plotted against `athlete_baseline_14` via 3.2's `RadarChart`.
**Done when — machine-checkable:** re-opening the Today tab after submitting shows this state, not the form, for the rest of that calendar day (verified by querying with a mocked/advanced date across the midnight boundary).

### 3.6 — Body map screen wiring `[ ]`

**Depends on:** 3.3, 3.4.
**References:** product spec §6.2 (both trigger paths).
**Spec:**
- Automatic trigger already wired in 3.4 (picking soreness ≤2 opens the sheet directly — nothing left to do here for that path).
- Persistent manual entry point: a small "Something hurts?" link near the top of the Today tab, reachable regardless of check-in state — opens the same bottom-sheet mechanism 3.4 built, not a route.
- Both paths land on 3.3's component, write to `body_map_entries` identically.

**Done when — machine-checkable:** the manual entry path writes `body_map_entries` rows in the same shape as 3.4's automatic path.

### 3.7 — Log a Session (RPE) `[ ]`

**Depends on:** 1.13, 2.1.
**References:** product spec §6.3 (no session-calendar gating, always available).
**Spec:**
- Floating action button, persistent on Today and History tabs. iOS: plain styled button now, upgraded to Liquid Glass treatment in 7.1 — don't block this ticket on that.
- Sheet: "How hard did that session feel?" 1–10 tap-to-select, optional one-line note, one-tap submit.
- Writes via 2.1's offline queue to `rpe_logs` with a real timestamp (`logged_at`), not just a date.

**Done when — machine-checkable:** reachable from both tabs; multiple same-day submissions both persist as distinct rows.
**Done when — device-checkable:** submits correctly offline and online.

### 3.8 — History screen `[ ]`

**Depends on:** 1.13, 3.1.
**References:** product spec §6.4; tech plan §10 (`react-native-gifted-charts`, `react-native-calendars` — standard integrations).
**Spec:**
- Line chart: `wellness_score` over time (trailing 14-day average **including current day**, per 3.1's display-vs-comparison distinction) vs. `athlete_baseline_14`, via `react-native-gifted-charts`.
- Calendar view: colour-coded daily averages via `react-native-calendars` — every colour cue paired with a text/icon cue, never colour alone.
- Load-trend indicator: "Training load this week: ↑ / → / ↓ vs last week" — compare this week's summed `rpe_value` to last week's; ↑ if >10% higher, ↓ if >10% lower, → otherwise. Plain arrow, not a numeric ratio.
- Empty state for a new athlete with no history: explanatory copy, not a blank chart.

**Done when — machine-checkable:** all three elements render against seeded multi-week fixture data with the correct trend arrow for known fixture RPE totals; empty state renders for a profile with zero `daily_checkins`.
