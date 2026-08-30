# Epic 9 — Public Release

### 9.1 — App Store Connect listing `[ ]`

**Depends on:** 8.4 (or a deliberate decision to proceed without full pilot iteration).
**References:** out of this plan's code scope — use the `aso-appstore-screenshots` and related ASO skills for asset generation/copy when this comes up; tracked here only as a checklist item.
**Spec:** real icon (replacing 1.2's Expo-starter placeholder), screenshots, description, keywords.
**Done when — device-checkable:** listing passes App Store review's metadata checks (before the binary submission in 9.3).

### 9.2 — Play Store listing `[ ]`

**Depends on:** 8.4.
**References:** same note as 9.1.
**Spec:** equivalent Play Store listing assets.
**Done when — device-checkable:** listing passes Play Console's pre-launch checks.

### 9.3 — Production build + submission `[ ]`

**Depends on:** 9.1, 9.2, 5.2 (real, non-sandbox RevenueCat pricing must be finalized by now — the one deferred pricing decision has to close before this ticket, not during it).
**References:** tech plan §12, §15 step 8.
**Spec:** finalize the `production` EAS profile with real pricing, `eas build --profile production` both platforms, submit via `eas submit`.
**Done when — device-checkable:** both apps are live (or in final store review) on their respective stores.

### 9.4 — Universal links upgrade `[ ]`

**Depends on:** a marketing-site domain existing.
**References:** explicitly deferred from 1.8/4.11's custom-scheme-only v1 approach.
**Spec:** once a real domain exists for the Vercel-hosted marketing site, add `apple-app-site-association` and Android `assetlinks.json`, switch magic-link and team-invite links to `https://` universal links, keep `tulla://` as a fallback rather than removing it.
**Done when — device-checkable:** tapping a magic-link/invite link from a real email client opens the app directly; old custom-scheme links still work as a fallback.

### 9.5 — Post-launch monitoring `[ ]`

**Depends on:** 9.3.
**References:** tech plan §11 (Sentry/Mixpanel already wired throughout — this ticket establishes review cadence, not new integration).
**Spec:** a short written cadence for checking Sentry error rates and Mixpanel funnel dashboards post-launch (daily for the first week, weekly after) — documented, not just done once.
**Done when — machine-checkable:** the cadence is written down (this file or a linked doc) and has been followed for at least the first week post-launch.
