import * as Sentry from '@sentry/react-native';

/**
 * Crash/error reporting (plan 1.10) — the old Flutter app shipped with none of this at all.
 * Call once, as early as possible in the app entry (`_layout.tsx`), before anything else can throw.
 */
export function initSentry() {
  Sentry.init({
    dsn: process.env.EXPO_PUBLIC_SENTRY_DSN,
    // Source maps are uploaded at build time by the `@sentry/react-native` config plugin
    // (app.json), authenticated via the SENTRY_AUTH_TOKEN build-time env var — never a value
    // baked in here.
    enableAutoSessionTracking: true,
    tracesSampleRate: 1.0,
  });
}

export { Sentry };
