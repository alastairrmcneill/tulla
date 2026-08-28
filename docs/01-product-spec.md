# Product Spec — Tulla

**Status:** v1 scope, ready for design. Revised to reflect: team creation as the paid/trial-gated feature, restructured onboarding, A/B testing hooks, and native per-platform design system.
**Audience:** Claude Design (visual prototype), and as the shared reference for the technical plan and marketing plan that follow this document.
**Platform:** iOS + Android, phone and tablet. Mobile app only — no web app in v1.

---

## 1. Product Vision

A daily wellness check-in for athletes, built on the same self-report methodology used in elite sport (ASRM — Athlete Self-Report Measures), paired with a coach view that turns those answers into one clear "who needs attention today" signal. **Individual athlete tracking is free forever.** Coaching a team is the paid product — creating a team starts a free trial, and continued access requires a subscription after that.

Design principle to hold onto throughout: **every check-in screen should feel like it takes seconds, not minutes.** Athletes have no obligation to use this — it's not mandated by an employer — so friction there is the enemy of the whole business, even though the coach side is now paid from the start.

---

## 2. Users & Roles

No forced "I am a coach" / "I am an athlete" account type — one account, one app. Anyone can track their own wellness for free. Anyone can start a team, which begins the trial. The same person can be both (very common in grassroots sport — player-coaches, team captains).

---

## 3. Onboarding & Personalization Flow

**Design principle** (per App Masters / Steve P. Young's research on subscription app onboarding): sign-up and the paywall move to the _end_ of the flow, after a short, tap-only personalization sequence that builds investment and lets the paywall message reflect what the person actually said they need. No typing required before sign-up, no forms — taps only.

1. **Welcome screen** — one strong statement of what the app does, single "Get started" CTA. No sign-up yet.
2. **Q1 — Role:** _"What brings you here?"_ → Track my own wellness / Coach a team / Both. Branches the rest of the quiz; does not hard-lock anything later — a person on the athlete path can still start a team afterward.
3. **Q2 onward, branches by role:**
   - **Athlete-leaning path:** sport (short list + "Other"), how often they train (buckets), what they want out of it (single-select: avoid burnout / spot patterns in how I feel / just curious).
   - **Coach-leaning path:** sport they coach, rough squad size (1–8 / 9–15 / 16–25 / 25+), and — the single highest-leverage question in the flow — **"What's your biggest challenge right now?"** (single-select: Spotting fatigue before it's a problem / Deciding who plays each session / Getting athletes to actually engage / Something else). This exact answer gets echoed back as the paywall headline later (Section 7).
4. **Light market-research question** (either path): _"How do you currently track this, if at all?"_ → Nothing / Spreadsheet / WhatsApp or texts / Another app. Doubles as genuinely useful founder-facing data — captured via Mixpanel regardless of what happens downstream.
5. **Brief "personalizing" transition screen** — short animated/loading moment ("Setting things up based on your answers"). Standard pattern; reinforces that what follows is tailored, not generic.
6. **Value preview screen** — a short, concrete illustration built from their answers. Coach path: a mocked example of a flagged-list entry relevant to the challenge they picked. Athlete path: a mocked example of their own radar/history chart. Illustrative, not a live demo.
7. **Sign up** — email/password or magic link (Supabase Auth), framed as "save your setup" rather than a cold account wall, since several taps of investment already exist by this point.
8. **Paywall (coach path only):** headline dynamically pulls the Q3 challenge answer (e.g. "spotting fatigue" → something like _"Catch fatigue on your team before it becomes a problem"_). Single CTA: **"Start your free 7-day trial."** No card, no payment info (see Section 7 for why). Athlete-only path skips this screen entirely and lands straight in their first check-in — forcing paywall exposure on a free feature would just be irritating.
9. **Team creation** (coach path, immediately after starting the trial) — name the team, optional sport tag, etc.
10. **Land in the app** — Today tab (athlete path) or Team Home (coach path, trial active).

**Honest caveat:** this is deliberately longer than a minimal "sign up and go" flow, on the strength of the research above — but the same research world also has cases where _removing_ an onboarding quiz outperformed optimizing it. Treat the flow above as the first hypothesis to A/B test (Section 10), not a settled decision.

---

## 4. Information Architecture

**Phone — bottom tab bar, 4 tabs:**

| Tab          | Contents                                                                                                                                                                                                                                                                                                                                            |
| ------------ | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| **Today**    | The daily check-in (or, if already completed today, a "done for today" state showing today's radar chart)                                                                                                                                                                                                                                           |
| **History**  | Personal history: line chart vs. baseline, calendar view, daily averages                                                                                                                                                                                                                                                                            |
| **Teams**    | Teams you're in — as athlete, as coach, or both. Tapping a team you _coach_ opens Team Home. Tapping a team you're an _athlete on_ opens a read-only Team Info screen. A persistent "+ Create a team" action lives at the top — tapping it, for someone with no active trial or subscription, leads straight into the trial-start flow (Section 7). |
| **Settings** | Account, notifications, theme, data/privacy, log out, delete account                                                                                                                                                                                                                                                                                |

**Tablet — adaptive layout.** Bottom tabs collapse into a persistent left-hand sidebar (same 4 destinations) at the standard tablet breakpoint. **Team Home specifically becomes a master-detail split view on tablet:** the flagged/roster list occupies the left ~35%, athlete detail opens in the right ~65% pane rather than pushing to a new screen. Every other screen on tablet is the phone layout at a larger, centered width.

---

## 5. Screen Inventory

| #   | Screen                         | Role    | Notes                            |
| --- | ------------------------------ | ------- | -------------------------------- |
| 1   | Welcome / personalization quiz | Both    | Section 3                        |
| 2   | Sign up / log in               | Both    | Section 3, step 7                |
| 3   | Today (check-in / done state)  | Athlete | Section 6.1                      |
| 4   | Body map (conditional)         | Athlete | Section 6.2                      |
| 5   | Log a session (RPE)            | Athlete | Section 6.3                      |
| 6   | History                        | Athlete | Section 6.4                      |
| 7   | Teams list                     | Both    | Section 4                        |
| 8   | Trial start / paywall          | Coach   | Section 3 step 8, Section 7      |
| 9   | Create team                    | Coach   | Section 6.5                      |
| 10  | Team Home                      | Coach   | Section 6.6 — adaptive on tablet |
| 11  | Athlete detail                 | Coach   | Section 6.7                      |
| 12  | Roster / invite                | Coach   | Section 6.8                      |
| 13  | Custom questions setup         | Coach   | Section 6.9                      |
| 14  | Team Info (read-only)          | Athlete | Section 4                        |
| 15  | Join team (code entry)         | Athlete | Section 6.10                     |
| 16  | Consent screen                 | Athlete | Section 6.10                     |
| 17  | All responses (raw list)       | Coach   | Section 6.6                      |
| 18  | Trial-expired lockout screen   | Coach   | Section 7                        |
| 19  | Notifications inbox            | Both    | Section 6.11                     |
| 20  | Settings / account             | Both    | Section 6.12                     |

---

## 6. Detailed Flows

### 6.1 Daily Check-in (Athlete)

Single scrolling screen, not a multi-step wizard — every question visible with a scroll, to keep total time under a minute:

1. Fatigue (1–5, labelled scale: "Always tired" → "Very fresh")
2. Sleep quality (1–5)
3. Muscle soreness (1–5)
4. Stress (1–5)
5. Mood (1–5)
6. Availability (3-point: reduced / available / fully available — smiley-icon pattern)
7. Any coach-defined custom questions (0–2), visually set apart with a "Questions from your coach" divider.

Submit disabled until core questions are answered. If muscle soreness is rated 1 or 2, immediately show the body map screen (6.2) before the done state; otherwise go straight to a "You're done for today" state with today's radar chart vs. personal baseline.

### 6.2 Conditional Body Map

Only triggered by a low soreness rating, or manually opened via an always-available "something hurts?" link. Front/back body outline, tap-to-mark location(s), each tap opens a small severity picker (mild/moderate/severe) plus an optional one-line note. No mandatory fields beyond the tap itself.

### 6.3 Log a Session (RPE)

Reachable via a persistent floating action button on Today and History, always available in v1 (no session-calendar gating — deferred, see Section 13). "How hard did that session feel?" — 1–10 tap-to-select, optional one-line note, one tap to submit.

### 6.4 History

Line chart of wellness score vs. personal baseline. Calendar view with colour-coded daily averages. Simple load-trend indicator below: "Training load this week: ↑ / → / ↓ vs last week" from RPE entries — a plain trend arrow, not a numeric ratio (full ACWR deferred, see Section 13).

### 6.5 Create Team (Coach)

Reached only after the trial has been started in onboarding (or, for an existing user creating an additional team later, after re-confirming trial/subscription status — see Section 7). Name the team, optional sport tag. On completion: join code generated, land on Team Home with the trial countdown visible.

### 6.6 Team Home (Coach)

The single most important screen in the product. Top to bottom:

1. **Trial/subscription status banner** — e.g. "Free trial: 4 days left," or, if this is an additional team created after a prior subscription, no banner needed.
2. **Flagged list** — athletes below their own personal baseline, reporting meaningful pain, or showing a rising load trend, merged into one list, sorted by severity. Each row: name, a short reason chip, tap to open athlete detail.
3. **Today's completion** — "8 of 12 checked in today," tap to see who's missing, with a one-tap "send reminder" push notification per missing athlete.
4. **Team wellness trend** — small chart, team average over the last 2 weeks vs. baseline.
5. **"See all responses"** button → raw list (screen 17).

Tablet: items 2 and athlete detail (6.7) combine into the split view from Section 4; items 1, 3, 4 sit full-width above it.

### 6.7 Athlete Detail (Coach)

Individual radar chart, personal history line chart, recent body-map reports, RPE/load history, custom question answers. Read-only from the coach's side.

### 6.8 Roster / Invite

Join code with a native share-sheet button. Member list with role indicator (member/admin), "promote to admin" / "remove" per member.

### 6.9 Custom Questions Setup

Up to 2 questions. Per question: text, type (scale 1–5 / yes-no / short text), required-or-optional toggle, live preview of how it appears on the athlete's check-in.

### 6.10 Join Team + Consent (Athlete)

Enter a join code, or arrive via a shared deep link. Before joining, a consent screen — team name, coach's name, plain text:

> _"Your coach, [Coach Name], will be able to see your daily check-in answers — including your wellness ratings, any pain you report, and answers to their custom questions — for [Team Name]. Your answers are never visible to your teammates."_

Two buttons: **"Join team"** (primary) / **"Not now."** One-time per team joined.

### 6.11 Notifications

Push triggers: an athlete crosses into "flagged" status; a coach taps "send reminder" for a specific athlete; a daily check-in reminder for athletes who haven't logged today (configurable time, default early evening); trial ending soon (day 5 of 7), once. In-app inbox mirrors all of these for anyone who declined push permission.

### 6.12 Settings & Account

Theme (light/dark), notification time preference, account details, change password, delete account (with confirmation), privacy policy / terms links, log out, "Restore Purchases" (see Section 7).

---

## 7. Trial & Paywall Mechanics

This is the core of the business model, restated plainly:

- **Always free, forever, no trial:** an individual's own check-in, personal history/insights, RPE logging, body map — entirely independent of any team.
- **Team creation is the paid feature.** Starting a team automatically starts a **7-day free trial** — no payment info collected at that point. This is a **database-tracked trial** (a `trial_started_at` timestamp on the team record, checked server-side), _not_ a native App Store/Play Store trial — see the technical rationale below.
- **During the trial:** full team functionality — roster, check-ins flowing to the coach, flagged list, trends, custom questions, everything, no feature gating within the trial period itself.
- **On trial expiry, unpaid: full lockout of Team Home.** A blocking screen replaces it: _"Your trial has ended — subscribe to keep using [Team name],"_ with a single purchase button. **This is the one and only moment an actual RevenueCat/IAP transaction happens** — native StoreKit (iOS) / Play Billing (Android) purchase flow, handled by RevenueCat.
- **No data is ever deleted on lockout.** Every response collected during the trial stays intact, so if a coach subscribes later — even weeks later, after a club committee approves the spend — everything is exactly where it was left. This matters specifically for grassroots/university clubs, where a "yes" often needs treasurer or committee sign-off that won't land inside 7 days.
- **Athletes on a locked team:** unaffected on their own side — personal tracking keeps working exactly as normal, since that's independent of any team. What pauses is specifically the _team_ relationship: a plain notice appears on their Team Info screen (_"Your coach's trial has ended — your check-ins still work, but they won't be shared with the team until they resubscribe"_), and coach-defined custom questions simply stop appearing until the team is active again. An athlete is never penalized for their coach's billing status.
- **Restore Purchases:** required in Settings, standard for any IAP-based app — covers reinstalls and device switches.

**Why database-tracked, not a native store trial:** a genuine StoreKit/Play Billing free trial is a real subscription with a £0 introductory period attached — the user still goes through the OS purchase-confirmation flow (Face ID/password) and it auto-charges after 7 days unless cancelled, tied to whatever payment method is already on their Apple ID/Google account. That's a legitimate pattern many apps use, but it's a different experience from "no card, decide separately later," which is what's specified here. A simple database flag matches that intent directly, keeps the _actual_ purchase as one deliberate, isolated event, and makes trial length trivially A/B-testable (a config value, not multiple App Store product SKUs).

---

## 8. Data & Privacy in UI

- No athlete ever sees another athlete's individual answers — enforced in UI (no such screen exists) and at the data layer (Row-Level Security) as defence in depth.
- Consent screen (6.10) is mandatory before a check-in becomes visible to a coach.
- Body map / injury data carries the same visibility rules as core check-in data.
- Locked-team behaviour for athletes: see Section 7.
- Out of scope for v1: under-18 / parental consent flows (see Section 13).

---

## 9. Notification Strategy — Copy Examples

- Flag triggered: _"[Athlete name] may need a check-in today — [reason, e.g. 'reported hamstring soreness']."_
- Missing check-in reminder (coach-initiated): _"Reminder: don't forget today's check-in for [Team name]."_
- Daily self-reminder: _"Quick one — how are you feeling today?"_
- Trial ending: _"Your free trial for [Team name] ends in 2 days."_

Keep all copy short, plain, calm — never alarmist, this is a wellness tool, not a warning system.

---

## 10. A/B Testing & Experimentation Hooks

Both onboarding and the paywall need to be genuinely testable from the start, not retrofitted later — this shapes how they're built.

- **Paywall experiments** (headline copy, price, trial length): use **RevenueCat's built-in Paywalls + Experiments** feature. Purpose-built for exactly this, integrates natively since RevenueCat is already the IAP layer, reports trial-start and conversion metrics without extra plumbing.
- **Onboarding flow experiments** (question order, quiz-vs-no-quiz, copy variants): RevenueCat doesn't cover this since it's not subscription-related. Use a lightweight custom approach instead — assign a variant via a deterministic hash at first open, store the assignment, track exposure plus every downstream funnel step (quiz started → quiz completed → signed up → trial started → subscribed) as named Mixpanel events. Deliberately not adding a dedicated feature-flagging SaaS on top of everything else — keeps the vendor count down.
- Every screen and copy string in the onboarding/paywall flow (Section 3) should be pulled from config rather than hardcoded, specifically so a variant can ship without an app store release.
- First test worth running, given the research genuinely conflicts on this point: the full personalization quiz above vs. a stripped-down 2-question version. Don't assume the longer version specified in Section 3 is automatically the winner.

Full technical implementation of this lives in the Technical Implementation Plan (next document).

---

## 11. Visual & Tone Direction

**Tone**, for Claude Design to work from in lieu of a locked visual identity:

- Warm and approachable, not clinical or "enterprise sports science" — built for volunteer coaches and amateur athletes, not pro sports science departments.
- Confident and calm rather than alarmist — the flagging system should read as "worth a conversation," never a medical warning.
- Usable one-handed, standing on a sideline, possibly in bright outdoor light — high contrast and large tap targets over dense information.
- Credible enough that a coach trusts it with real decisions, without feeling corporate.

**Native design system requirement:** lean into each platform's own current native visual language rather than one custom cross-platform look.

- **iOS:** Apple's **Liquid Glass** material (translucent, light-refracting surfaces — tab bars, sheets, floating controls) introduced in iOS 26. Implemented via `expo-glass-effect` or `@callstack/liquid-glass` from the React Native side (full detail in the technical plan).
- **Android:** Material 3 idioms, native to the platform — not a forced imitation of the iOS look.
- **Real constraints Claude Design needs to design around, not just Claude Code:** Liquid Glass is iOS 26+ only, with no real equivalent on Android or older iOS. Every glass surface needs a deliberately designed fallback state (a solid or lightly translucent background), not an afterthought — this also covers users with "Reduce Transparency" enabled in iOS accessibility settings, who should never see the glass effect at all regardless of OS version.

---

## 12. Accessibility Requirements

- Support OS-level dynamic type / font scaling throughout.
- All interactive elements (sliders, scale pickers, body map tap zones) need VoiceOver/TalkBack labels and values, not just visual state.
- The flagged/traffic-light system must never rely on colour alone — pair red/amber/green with icon or text label.
- Minimum tap target size per platform guidelines, especially on check-in scale pickers.
- Liquid Glass / translucent surfaces must respect "Reduce Transparency" (see Section 11).

---

## 13. Offline & Connectivity Behavior

Athletes may be checking in from pitches, sports halls, or venues with poor signal. A submitted check-in, RPE log, or body-map entry must never be lost due to connectivity:

- Save to local device storage immediately on submit.
- Sync to the backend in the background with retry logic.
- Show a subtle, non-blocking "syncing" indicator when a sync is pending; never block the UI on network.

---

## 14. Empty States & Error States

- New athlete, no history yet: explanatory empty state, not a blank chart.
- New team, no responses yet: "Waiting on your first check-ins," not an empty flagged list with no explanation.
- Failed team-code join (invalid code): clear inline error, not a generic failure dialog.
- Network failure on any read: cached last-known state where possible, with a retry affordance.

---

## 15. Explicitly Out of Scope for v1

- Web dashboard for coaches (mobile-only for v1; revisit if pilot coaches ask unprompted)
- Wearable/platform integrations (Apple Health, Garmin, Coros, Strava)
- Proper ACWR (acute:chronic workload ratio) — v1 uses a simple week-over-week trend arrow
- RPE prompts gated to a session calendar
- Under-18 / parental consent flows
- Native store-level (StoreKit/Play Billing) trial mechanism — decided against in favour of a database-tracked trial (Section 7)
- Dedicated feature-flagging SaaS (e.g. LaunchDarkly, Statsig) for experimentation — using RevenueCat Experiments + a lightweight custom/Mixpanel approach instead (Section 10)
- Social login (Google/Apple sign-in) — email/password + magic link only for v1
