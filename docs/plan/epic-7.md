# Epic 7 — Native Polish

### 7.1 — iOS Liquid Glass full pass `[ ]`

**Depends on:** 1.4.
**References:** tech plan §9, §11.
**Spec:** real `expo-glass-effect` treatment (beyond 1.4's throwaway smoke test) on: tab bar, sheets/modals (5.3's lockout screen, 6.7's paywall, 3.3's severity picker, 3.7's RPE sheet). Every surface gets its defined fallback (0.2's `colors.glass.*.fallbackBackground`) for iOS <26 and Reduce Transparency — verify each surface individually.

- **3.7's FAB is not just a glass-wrapped floating circle — dock it into the tab bar instead.** Confirmed while building 3.7: `expo-router@57.0.17`'s `expo-router/unstable-native-tabs` (already used by `(tabs)/_layout.tsx`) exports `NativeTabs.BottomAccessory`, a direct wrapper on Apple's iOS 26 `UITabBarController.bottomAccessory` — the actual current standard for a persistent tab-bar-attached action (this is how Apple Music's mini-player sits above its own tab bar: same glass surface, not a separate floating element). Real scope beyond a glass reskin: the accessory is declared once at the `<NativeTabs>` root (sibling of the `Trigger`s), so hiding it on Teams/Settings needs its own visibility logic (route-aware, e.g. via `usePathname()`); it renders in one of two placement modes (`regular`/`inline`, via `usePlacement()`) that may need different content; and it's iOS 26+ only, so pre-26 devices need a fallback — today's plain floating button is exactly that fallback, not something to throw away.


**Done when — device-checkable:** every listed surface renders glass correctly on iOS 26, and falls back correctly (not broken/transparent) on iOS <26 and with Reduce Transparency enabled.

### 7.2 — Android Material 3 pass `[ ]`

**Depends on:** 1.13.
**References:** tech plan §9.
**Spec:** React Native Paper primitives for Android-specific chrome — `.android.tsx` variants for tab bar, buttons, sheets, alongside 7.1's `.ios.tsx` glass versions. Everything else (forms, check-in screen, charts, lists) stays shared.
**Done when — device-checkable:** Android build shows genuine Material 3 chrome; shared components render identically to iOS minus platform-specific chrome.

### 7.3 — Accessibility final audit `[ ]`

**Depends on:** every screen ticket in Epics 3–6 (each already carries inline a11y criteria — this is the cross-cutting sweep for what inline review can't catch).
**References:** product spec §12 in full.
**Spec:** dynamic-type stress test at the largest OS text size across every screen, full VoiceOver (iOS) and TalkBack (Android) pass through the core paths, Reduce Transparency verification across every 7.1 glass surface, colour-contrast check on `status.*` tokens against both backgrounds.
**Done when — device-checkable:** a written checklist (one line per product spec §12 requirement) fully checked against a real device run, not simulator-only.

### 7.4 — Offline/empty/error states verification `[ ]`

**Depends on:** every screen ticket, 2.1, 2.2.
**References:** product spec §14.
**Spec:** confirm each already-built behaviour: new-athlete empty history (3.8), new-team no-responses (4.5), invalid join-code inline error (4.11), cached-last-known-state-with-retry on network failure (2.2's `<RetryBanner/>`, built once in Epic 2 and used by every read screen since — this ticket verifies the pattern actually landed everywhere it should, not an open-ended audit for gaps).
**Done when — device-checkable:** each of product spec §14's four points demonstrably true on a real device with network conditions manipulated (airplane mode, then restored).

### 7.5 — Performance/polish pass `[ ]`

**Depends on:** every screen ticket.
**References:** general quality bar.
**Spec:** loading skeletons where a blank screen would otherwise show during fetch, list virtualization check on Roster/All-Responses/History for larger teams, image optimization pass.
**Done when — device-checkable:** no visible jank or blank-flash on the core paths during a full manual run-through.
