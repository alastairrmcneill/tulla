# Marketing & Distribution Plan — Tulla

**Status:** v1 go-to-market plan.
**Depends on:** `01-product-spec.md` and `02-technical-implementation-plan.md` — this plan assumes the product, pricing mechanics, and trial model described there.

---

## 1. The Timeline, Honestly

The original plan anchored on university/club seasons restarting at a fixed point in the academic year — that assumption predates this rewrite and is no longer realistic as a near-term target. Rebuilding the stack, the onboarding, native design, billing, and A/B infrastructure at 10–15 hrs/week is realistically a **4–6 month build** even before real-world iteration, which points to a working pilot-ready build landing **roughly 3–5 months from now**, not on the original tight timeline.

That's not actually a problem, once the plan is structured around it correctly:

- **Pilot recruitment doesn't need a "season start" moment.** You're asking 5–10 individual coaches to try something, not launching to a market — an active club mid-season is a perfectly good pilot target, and this can start the moment a `preview`/TestFlight build exists, whenever that lands.
- **The wider public push (App Store listing live, community post, ASO, governing-body outreach) is what should wait for a real moment**, and the nearest realistic one is **roughly 4–6 months from now** — UK university clubs commonly run fresh recruitment pushes at more than one point in the academic year, not only at the very start of the season, so it's a genuine second window, not a consolation prize. If the build slips further, **roughly a year from now** (the original "new season" moment this plan first anchored on) is the fallback, not a failure.

Everything below is structured in phases rather than fixed calendar dates, specifically so slippage in the build doesn't invalidate the plan — each phase starts when the previous one is actually done, not on a fixed date.

---

## 2. Who This Is For (Recap)

Amateur ultimate frisbee clubs and university sports clubs (any sport, ultimate first) — volunteer-run, fast decision-making, no procurement process, and genuinely reachable without a personal network via public club directories. PTs and school/institutional programs are deliberately out of scope for now (per earlier scoping) — revisit once there's cash flow to spend on the channels those segments actually need.

**Geographic reality:** the app itself is available anywhere from day one — no reason to geo-restrict it. But the actual outreach in Phases A–D below is deliberately UK-concentrated, because that's where the tractable channels (UK Ultimate's directory, BUCS clubs, your own Edinburgh presence) and your own credibility as a player actually are. US and Australian expansion is real and worth doing — it's Phase F, once the UK playbook is proven, reusing the same approach against USA Ultimate and the Australian Flying Disc Association's club networks. Don't split focus before then.

---

## 3. Phase A — Parallel Validation (Now, During the Build)

Already agreed earlier: while the rebuild is underway, spend a few hours messaging 10–15 real club captains/coaches — not selling, asking. Two things to get out of these conversations specifically, now that the product is more concrete:

1. **Whether "nobody tracks this today" is really true**, and what it's actually costing them not to.
2. **A real read on price.** Don't run a formal survey — in each conversation, ask something like: _"If this cost about the same as a couple of coffees a month, does that feel like an easy yes, a stretch, or not something you'd have thought to pay for at all?"_ Note any number they volunteer unprompted — that's worth more than their answer to a direct question. Cross-reference against the established competitor floor (roughly €15–16/month per team from Fractall and Coach ID App) as a sanity ceiling, and use this to set the actual price before Phase D, replacing the `[price]/month` placeholder still sitting in the product spec.

**Suggested starting hypothesis to test** (via the RevenueCat Experiments setup in the technical plan, Section 7): **£7.99/month vs £12.99/month**, both meaningfully below the per-team competitor floor — sensible given this is aimed at a more price-sensitive grassroots budget than the established players, and one subscription now covers a coach's _entire_ set of teams, not just one.

---

## 4. Phase B — Pilot Recruitment (Once a Preview Build Exists)

**Build the target list.** This is a spreadsheet task, not a networking task — no personal contacts required:

- UK Ultimate's affiliated club directory
- BUCS university ultimate clubs (and BUCS more broadly, if you're open to other university sports once the beachhead proves out)
- UltiCal's public club listings, which include member counts and contact routes

Aim for 50–100 clubs in the list before you start messaging — gives enough surface area that a modest response rate still yields real pilots.

**Direct message to club captains**, adjusted from the earlier draft to reflect the actual product now:

> Hey [name] — I play ultimate myself (was on [team] at Worlds) and I'm building a proper version of a wellness check-in app I made for my own team during the tournament — coaches get a daily flag on who's trending tired or sore, athletes get a 2-minute check-in. I'm looking for a few clubs to pilot it free this season before it goes properly live, in exchange for honest feedback. Would [club] be up for it?

**One honest post**, not a content calendar, in the relevant UK Ultimate Facebook groups/forums — same real story, not a sales pitch:

> Built this originally for [team] at Worlds — daily check-in for players, coach gets a flag on anyone trending below their normal baseline instead of having to guess. Properly rebuilding it now and looking for a handful of UK clubs willing to pilot it this season for free, in exchange for brutal feedback. Anyone interested?

**One partnership email to UK Ultimate itself**, asking if they'd mention it to affiliated clubs once there's a working pilot to point to — free, high-leverage, worth sending even if the answer is no.

**In-person, in Edinburgh** — you can physically show up to a local university or club session and sign up your first design partners face to face. This is worth more than ten cold DMs and costs nothing but time you already have.

**Give pilots something real for showing up early:** extended free access for the season (not just the standard 7-day trial), granted manually — per the technical plan's data model, this is a one-line update to `profiles.subscription_active` in the Supabase dashboard for each pilot account, no extra engineering needed. Frame it as thanks for early feedback, not a discount — it's a stronger, more honest pitch than a percentage off a price nobody's seen yet.

---

## 5. Phase C — Iterate on Real Feedback

Watch activation, not just opinions — per the Mixpanel events already defined in the technical plan (`checkin_completed`, `flag_triggered`, `paywall_viewed`), the real signal at this stage is whether a pilot coach's _athletes_ actually keep checking in week over week, not whether the coach said something nice in a message. A coach who's enthusiastic but whose team stops checking in after week one is telling you something more important than their words are.

Deliberately no fixed time box here — this phase ends when the product is holding up under real, unprompted use, not on a calendar date.

---

## 6. Phase D — The Wider Public Push (Roughly 4–6 Months From Now, or ~1 Year Out as Fallback)

This is what actually needs a real "moment" behind it, unlike pilot recruitment:

- **App Store / Play Store listing goes live**, ASO-optimized around terms a coach would actually search — "team wellness tracker," "athlete monitoring," "coach wellness check-in" — rather than generic fitness-app language.
- **Enroll in Apple's and Google's small-business fee programs immediately** — both offer a reduced commission (historically 15% rather than 30%) for developers under roughly $1M/year in revenue, which is trivially true here and costs nothing to claim; worth confirming the current rate in each dashboard since these programs occasionally get renamed or adjusted.
- **A second, wider version of the honest community post** from Phase B, now pointing at a real App Store listing instead of "email me to pilot."
- **A second, warmer version of the UK Ultimate partnership ask**, now backed by real pilot results and testimonials rather than a cold pitch.
- **Pilot coaches asked directly for a referral** to one other club or coach they know — the single highest-trust channel available to you, and free.

---

## 7. Phase E — Ongoing

- Keep the RevenueCat price experiment running past launch, not just during Phase A — real purchase data beats a handful of conversations.
- Revisit the PT and school/institutional segments only once there's cash flow to fund the content or paid channels those segments actually need — not before.
- **A pre-committed decision rule, so this doesn't become an indefinite grind:** if, after genuine outreach to 50+ clubs in the target list, fewer than roughly 10% start a trial, treat that as a real signal to revisit the messaging or the segment itself before pouring more outreach into the same list unchanged.

---

## 8. Phase F — Beyond the UK (Later)

Once the UK playbook is actually working — not before — the same shape of approach repeats against USA Ultimate's club network and the Australian Flying Disc Association's, reusing the outreach templates and list-building method from Phase B rather than inventing a new approach per country.

---

## 9. What Success Looks Like, Concretely

Tying back to the original target of £100–200/month profit within 6–12 months, and the ~£50/month cost ceiling: at a £9.99/month price point (roughly the middle of the tested range), that's on the order of **15–25 paying coaches** to hit the target — not hundreds. Worth stating plainly, because the beachhead alone (UK Ultimate clubs plus BUCS university clubs) almost certainly numbers in the hundreds, so this is a realistic slice of a small pond, not a market-share fantasy.

---

## 10. Explicitly Out of Scope for Now

- Paid advertising of any kind — no budget for it, and organic/direct channels haven't been exhausted yet.
- PT and school/institutional segments (Section 7 revisits this later, deliberately not now).
- Any US/Australia-specific outreach before the UK approach is validated (Phase F, not Phase B).
- A formal, structured pricing survey — the lightweight conversational approach in Phase A is proportionate to the stakes at this stage.
