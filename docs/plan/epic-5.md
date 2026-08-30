# Epic 5 — Billing & Subscriptions

The real-money half of trial/subscription mechanics — trial *start* and its client-side gating already exist from Epic 4. This epic covers the RevenueCat SDK, the lockout screen, and the one moment an actual purchase happens.

### 5.1 — RevenueCat SDK setup `[ ]`

**Depends on:** 1.9.
**References:** tech plan §6.
**Spec:** `react-native-purchases` install, `lib/revenuecat.ts` (fills 1.12's stub), `Purchases.configure()` on app start with the API key from EAS env, `Purchases.logIn(supabaseUserId)` immediately after Supabase auth succeeds (1.9) so RevenueCat and Supabase share one user identity.
**Done when — machine-checkable:** `Purchases.getCustomerInfo()` returns successfully against a real logged-in user in a dev build.

### 5.2 — RevenueCat dashboard configuration `[ ]`

**Depends on:** nothing (dashboard-only).
**References:** tech plan §6.
**Spec:**
- One entitlement: `coach_access`.
- Two products: `coach_monthly`, `coach_annual` — placeholder/sandbox pricing now; real pricing swapped in before 9.3's store submission (this is the one deliberately-deferred pricing decision in this plan — don't block this ticket on it).
- Matching store-side sandbox products in App Store Connect / Play Console.

**Done when — device-checkable:** both products linked to the entitlement in the RevenueCat dashboard; a sandbox purchase completes successfully.

### 5.3 — Trial-expired lockout screen `[ ]`

**Depends on:** 4.2.
**References:** product spec §7, screen 18.
**Spec:** replaces Team Home entirely once `team_has_access(team_id)` (4.2) is false for a team this user administers. Single CTA per spec §7 copy: _"Your trial has ended — subscribe to keep using [Team name]"_. Reachable specifically from wherever the trial banner would otherwise sit.
**Done when — machine-checkable:** an expired-trial admin's Team Home data fetch genuinely fails/returns nothing at the RLS layer (not just a UI route swap) — confirmed via a direct query as the expired admin.
**Done when — device-checkable:** the lockout screen shows instead of Team Home, with no way to reach real Team Home content underneath.

### 5.4 — Purchase flow `[ ]`

**Depends on:** 5.1, 5.2, 5.3.
**References:** tech plan §6, §7 ("this is the one and only moment an actual RevenueCat/IAP transaction happens").
**Spec:**
- `Purchases.purchasePackage()` triggered only from 5.3's lockout screen — no other purchase entry point in v1 (the onboarding paywall in 6.7 doesn't purchase anything, it only starts the trial via 4.1's trigger).
- Fetch the active offering via `Purchases.getOfferings()`, render whatever RevenueCat serves — never hardcode a price in the UI.
- On success: client refreshes `customerInfo` immediately on foreground, doesn't wait on 5.5's webhook round-trip to unlock.

**Done when — device-checkable:** a sandbox purchase from the lockout screen unlocks Team Home immediately, client-side.

### 5.5 — `revenuecat-webhook` Edge Function `[ ]`

**Depends on:** 1.7, 5.2.
**References:** tech plan §6.
**Spec:**
- Supabase Edge Function receiving RevenueCat webhook events, writing `billing_status.subscription_active`/`subscription_expires_at` via `service_role`.
- Handles `INITIAL_PURCHASE`/`RENEWAL` (set active) and **`EXPIRATION`/`CANCELLATION`** explicitly (set `subscription_active = false`) — this second half is what re-triggers lockout for a lapsed subscriber, not just first-time trial expiry.
- Verifies the RevenueCat webhook signature (shared secret) — rejects unauthenticated calls.

**Done when — device-checkable:** a sandbox-triggered `EXPIRATION` event flips `subscription_active` to false and the corresponding coach sees the lockout screen (5.3) on next app foreground.
