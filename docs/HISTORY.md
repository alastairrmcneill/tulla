# History — Tulla

Completed epics, kept for the record. Not read each session — `CODING_PLAN.md` and the current epic file under `plan/` are the active documents.

---

## Epic 0 — Design System & Theme Foundation

### 0.1 — Design tokens (spacing, radius, typography, motion) `[x]`

`src/theme/tokens.ts` — 4pt spacing scale, Material-3-shape-scale radius (`none…full`), Material-3-type-scale typography (`display/headline/title/body/label` × `Large/Medium/Small`, plus `overline`/`mono`), motion (`duration`/`easing`), `layout` constants (tab bar height, hairline, max content width). Committed `a56b723`.

### 0.2 — Colour tokens (dark + light) and `ThemeProvider` `[x]`

`src/theme/colors.ts` (`dark`/`light`, semantic roles: `background`/`surface`/`text`/`accent`/`status.{danger,warning,success}`/`glass.{tabBar,sheet}` with flat fallback colours for Reduce Transparency and Android). `src/theme/theme-context.tsx` — `ThemeProvider` + `useTheme()`, seeds `dark` regardless of OS setting. Committed `a56b723`.

### 0.3 — Native appearance sync (`Appearance.setColorScheme`) `[x]`

`theme-context.tsx` calls `Appearance.setColorScheme(mode)` at module load and in a `useLayoutEffect` keyed on `mode`, so `NativeTabs` (real SwiftUI, reads OS trait collection directly) tracks app theme instead of device Settings. Committed `a56b723`.

---

## Epic 1 — Foundation

### 1.1 — GitHub repo `[x]`
Private repo, `main` pushed with full history, branch protection deferred until 1.14's CI check exists.

### 1.2 — App identity & config `[x]`
`app.json`: `ios.bundleIdentifier` / `android.package` = `com.alastairrmcneill.tulla`, `scheme: "tulla"` confirmed.

### 1.3 — EAS project + build profiles `[x]`
`eas.json` with `development`/`preview`/`production` profiles; `expo-dev-client` confirmed installed.

### 1.4 — Liquid Glass smoke test `[x]`
`expo-glass-effect` confirmed rendering on iOS 26 dev build; Reduce Transparency fallback confirmed. Throwaway surface removed.

### 1.5 — Supabase project `[x]`
Fresh project created via Supabase MCP, CLI linked, `supabase/migrations/` ready.

### 1.6 — Core schema migration `[x]`
`profiles`, `billing_status` (incl. `trial_length_days`), `teams`, `team_members`, `custom_questions`, `daily_checkins`, `custom_question_responses`, `body_map_entries`, `rpe_logs`, `notifications` — 10 tables, indexes on `daily_checkins(profile_id,date)`, `team_members(team_id,profile_id)`, `rpe_logs(profile_id,logged_at)`.

### 1.7 — Row-Level Security `[x]`
RLS enabled on all 10 tables. `has_coach_access(p_profile_id)` function. `billing_status`: select-only for owner, no authenticated write policy. Coach-gated select via `team_members` join on `daily_checkins`, `body_map_entries`, `rpe_logs`, `custom_questions`, `custom_question_responses`. Tested both allowed and denied reads per table.

### 1.8 — Supabase Auth configuration `[x]`
Email/password + magic link enabled, social off. Email templates styled. Redirect URL `tulla://`. Deep link routing confirmed for `tulla://auth/callback`.

### 1.9 — Auth flow in-app `[x]`
`hooks/useAuth.ts`, sign-up/log-in screens under `(auth)/`, trigger creates `profiles` row on `auth.users` insert, session persistence confirmed across restarts. Note: these are the plain/standalone auth screens — the onboarding-framed presentation of sign-up is built fresh in Epic 6 (6.6), not a restyle pass over these.

### 1.10 — Sentry `[x]`
Project created, `@sentry/react-native` wired, source maps via EAS Build hooks, test error confirmed via Sentry MCP.

### 1.11 — Mixpanel `[x]`
Project created, SDK wired, anon identify via `expo-secure-store` UUID, `alias()` wired into 1.9's sign-up path, confirmed via Mixpanel MCP.

### 1.12 — Client library scaffolding `[x]`
`lib/supabase.ts` typed via generated `types/database.ts`. `lib/revenuecat.ts`/`lib/notifications.ts` stubbed pending Epics 5/2.

### 1.13 — Navigation scaffold `[x]`
Route groups per tech plan §2, placeholder screens for the full 20-screen inventory, real 4-tab `(tabs)` structure on `NativeTabs`.

### 1.14 — CI pipeline `[x]`
`.github/workflows/ci.yml` — `npm ci`, `tsc --noEmit`, `npm run lint` on every PR. `eslint.config.js` committed ahead of wiring CI.

---

## Epic 2 — Shared Data & Notification Infrastructure

### 2.1 — Offline-first write queue `[x]`
`lib/offline-queue.ts`: `enqueue(kind, payload)`, one `AsyncStorage` key per item (client-generated UUID, `@tulla/offline-queue/` prefix), local write commits before any network attempt. Background sync on enqueue, `NetInfo` reconnect, and app open. 3 attempts, 2s/10s/60s backoff (in-memory per sync cycle, not persisted — a fresh cycle starts on next app open/reconnect); final failure logs to Sentry, item stays queued. Upserts on `id` (client-generated) even for the two append-only kinds, so a retry after a lost-ack success can't duplicate a row; `daily_checkins` upserts on `profile_id,date` (its real unique constraint) for correct same-day last-write-wins. `useSyncStatus()` + `<SyncIndicator/>`. `@react-native-community/netinfo` added.

### 2.2 — Shared data-fetching hook `[x]`
`lib/query-client.ts`: `QueryClient` (`retry: 2`, `gcTime` 24h) + `AsyncStorage` persister (`maxAge` 24h), wraps app root in `<PersistQueryClientProvider>`. `<RetryBanner/>`: renders only when a query is erroring with no cached data; stays hidden on stale-but-cached renders. `@tanstack/react-query` + persist-client + async-storage-persister added. Binding rule for every later read screen: `useQuery` against this client, not a raw `useEffect` + fetch.

### 2.3 — Push notification infra + in-app inbox `[x]`
`profiles.expo_push_token` column added. `notifications` has no client insert policy by design (service-role only), so the real `sendPush()` logic lives server-side: `supabase/functions/_shared/send-push.ts` (insert notifications row unconditionally, call Expo's push API if a token exists, check the per-ticket status in the response body — Expo returns HTTP 200 even on a per-token delivery failure) deployed as the `send-push` Edge Function (`verify_jwt: true`; known gap — authorizes on "signed in", not on any relationship to the target profile, left for 4.5's actual UI to close). `lib/notifications.ts` (fills 1.12's stub): `registerForPushNotificationsAsync()` + `sendPush()` as a thin `functions.invoke()` wrapper. Real inbox screen at `app/notifications.tsx` (screen 19): `useQuery` list via 2.2, mark-read on open, `<RetryBanner/>`. `expo-notifications` added + `app.json` plugin entry. Device-verified end to end on a physical iOS device, including generating APNs push credentials via `eas credentials` (a local build never provisions these; only EAS Build does) — a first local build without them produced a confirmed `InvalidCredentials` failure, silently reported as success until the per-ticket-status check above was added.
