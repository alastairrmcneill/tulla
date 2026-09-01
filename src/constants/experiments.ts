/**
 * A/B testing hooks (plan 4.1, product spec §10). Read-only mirror of the
 * trial-length experiment for display/analytics labeling — the actual split
 * is resolved server-side, entirely inside `start_trial_for_creator()`
 * (private schema, epic4_teams_coaching migration). Never treat this object
 * as a source of truth for what a given profile's trial length actually is;
 * read `billing_status.trial_length_days` for that (see `useCoachAccess`).
 */
export const TRIAL_LENGTH_DAYS = {
  control: 7,
  variant_b: 5,
} as const;
