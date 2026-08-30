# Project Context for Claude Code

## Reference documents (read these first, every session)

- `docs/01-product-spec.md` — screens, flows, onboarding, paywall mechanics
- `docs/02-technical-implementation-plan.md` — stack, schema, RLS, billing architecture
- `docs/03-marketing-distribution-plan.md` — background only, not code-relevant
- `docs/CODING_PLAN.md` — thin index: epic list, current ticket, locked cross-cutting decisions. The full plan lives one file per epic under `docs/plan/epic-N.md`; completed epics are recorded in `docs/HISTORY.md`.

## Workflow — how to work through this project

This is a solo, part-time project (10–15 hrs/week), built across many short, separate sessions. Because of that:

1. **Start every session by reading `docs/CODING_PLAN.md`, then only the current epic's `docs/plan/epic-N.md`** to see what's in progress and what's next. Don't assume you remember — check. Don't read other epic files or `HISTORY.md` unless a ticket's own spec sends you there.
2. **Work one ticket of the current epic at a time.** Don't jump ahead to a later ticket, or a later epic, without finishing, or explicitly deferring, the current one.
3. **Before writing any code for a new section**, restate your understanding of what it requires and flag anything ambiguous or underspecified against the two spec documents. Wait for explicit confirmation before implementing — use Plan Mode for this step where it helps.
4. **After implementing a section, stop.** Summarize what changed, show the diff, and wait for explicit approval before running `git commit`. Never commit automatically, even if the change seems small or obviously correct.
5. **After approval**, commit with a message referencing the ticket number, tick its status in the current `docs/plan/epic-N.md`, update `docs/CODING_PLAN.md`'s "Next up" line, then stop and wait before starting the next ticket. When an epic's last ticket lands, move its section from the epic file into `docs/HISTORY.md` and drop the epic file's status in the index to done.

## Design fidelity

- Never hardcode colors, spacing, type sizes, or corner radii. Pull everything from the shared design-token/theme file (technical plan, Section 9) — if it doesn't exist yet, that's an early Phase 1 task, not something to improvise per-screen.
- Reference the actual exported screens in `design-reference/` (repo root) for any UI work. If the relevant screen is missing, ask for it rather than guessing the layout from the product spec's text description alone.
- iOS-specific chrome (tab bar, sheets, floating action button) uses Liquid Glass via platform-specific `.ios.tsx` files. Android-specific chrome uses Material 3 via `.android.tsx` files. Everything else stays shared — don't fork components that don't need forking. See technical plan, Section 9.

## Tools

- Use the Supabase MCP server for schema, migrations, and RLS work when it's connected — don't hand-write SQL blind if the tool is available to check against the real project.
- Use the Sentry MCP server to verify error-tracking is actually wired correctly, rather than assuming the integration code is sufficient.
- Use the Mixpanel MCP server to verify the funnel events from the technical plan (Section 7 and 11) are actually firing, not just that the tracking calls exist in code.
- Use the RevenueCat MCP to setup the projects and configure the settings for the app store and play store as well as setting up paywall experiments.
- If a tool call to any of these fails, check `/mcp` before assuming the server doesn't exist — it may just need reconnecting.

## What not to build yet

- The extended onboarding quiz (product spec, Section 10) — v1 ships the short flow only.
- A coach web dashboard, wearable/platform integrations, or proper ACWR load scoring — see product spec, Section 15, for the full out-of-scope list. Don't reintroduce these because they seem like natural extensions; they were deliberately deferred.
- A native App Store/Play Store trial mechanism — the trial is database-tracked (technical plan, Section 6). Don't "simplify" this back to a store-native trial without checking with the user first; it was a deliberate choice, not an oversight.
