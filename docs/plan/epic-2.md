# Epic 2 — Shared Data & Notification Infrastructure

Built early, on purpose: every screen ticket in Epics 3–6 depends on the patterns here (offline write queue, cached reads, push) existing already, so no screen ships a stub or gets a second pass later.

### 2.1 — Offline-first write queue `[ ]`

**Depends on:** 1.6.
**References:** product spec §13.
**Spec:**
- `lib/offline-queue.ts`: `enqueue(kind, payload)` writes to local storage (`AsyncStorage`, key = client-generated UUID) synchronously, before any network call. Background sync attempts on enqueue and on reconnect (`NetInfo` listener).
- Retry: 3 attempts, backoff 2s / 10s / 60s. On final failure, log to Sentry with the queue item's `kind` and keep the item queued for the next app open (never silently drop).
- Conflict handling: last-write-wins — every write this queue handles is either append-only or has a `unique(profile_id, date)` constraint (`daily_checkins`) that makes last-write-wins correct. No merge logic.
- `useSyncStatus()` hook exposing pending-item count. `<SyncIndicator/>` component: small non-blocking text/dot, shown near the top of a screen when pending > 0, never blocks input.
- Consumers: check-in submit (3.4), body-map entry (3.6), RPE log (3.7) — this ticket builds the utility only, those tickets wire it.

**Done when — machine-checkable:** a manual test calling `enqueue()` with the network mocked off shows the local write committed to `AsyncStorage` before the mocked network call fires.
**Done when — device-checkable:** submitting through a real consumer screen in airplane mode succeeds locally immediately and syncs once connectivity returns (batch this check with 3.4/3.6/3.7's own device checks, one pass).

### 2.2 — Shared data-fetching hook `[ ]`

**Depends on:** 1.12.
**References:** resolves the cross-cutting "cached-last-known-state + retry on every read screen" requirement (product spec §14) once, instead of an end-of-project audit.
**Spec:**
- Install `@tanstack/react-query` + `@tanstack/query-async-storage-persister` + `@tanstack/react-query-persist-client`.
- `lib/query-client.ts`: `QueryClient` with `retry: 2`, persisted to `AsyncStorage` via the persist-client plugin so the last successful result survives app restarts and offline opens.
- `<QueryClientProvider>` wraps the app root (`app/_layout.tsx`).
- `<RetryBanner/>` component: shown by a screen when its query has an error **and** no cached data exists yet; not shown when stale-but-cached data is rendering.
- **Binding rule for every later ticket:** every read screen (3.8 History, 4.5 Team Home, 4.6 Athlete Detail, 4.7 Roster, 4.9 All Responses, 4.10 Team Info, 2.3 inbox) uses `useQuery` against this client — not a raw `useEffect` + fetch. Stated once here; later tickets don't repeat it.

**Done when — machine-checkable:** a test query, forced to fail (mocked network error) after a prior successful fetch, still renders its last cached result via `<RetryBanner/>` staying hidden; forced to fail with no prior cache, shows `<RetryBanner/>`.

### 2.3 — Push notification infra + in-app inbox `[ ]`

**Depends on:** 1.13, 2.2.
**References:** tech plan §8; product spec §6.11 (trigger list), screen 19 (inbox).
**Spec:**
- `expo-notifications` install, permission prompt on first relevant screen open, Expo push token registration on grant, token stored on `profiles`.
- `lib/notifications.ts` (fills 1.12's stub): `sendPush(profileId, title, body)` — looks up the profile's stored token, calls Expo's push API, also inserts a `notifications` row (so the inbox always mirrors what was pushed, regardless of permission state, per spec §6.11).
- In-app inbox screen: reads `notifications` for the current profile via 2.2's `useQuery`, marks read on open (`notifications.read` update, own-row policy from 1.7).
- This ticket ships the infra and `sendPush()` only. The four trigger sources that call it — flag detection (6.11), missing-checkin reminder (4.5), daily self-reminder (6.10 note), trial-ending (6.10) — are wired in their own tickets, not duplicated here.

**Done when — machine-checkable:** a manually-inserted `notifications` row renders correctly in the inbox via 2.2's query hook; `sendPush()` called directly inserts both the row and (in a dev build) delivers a real Expo push.
**Done when — device-checkable:** permission prompt flow grants and a real Expo push token is visible on the `profiles` row.
