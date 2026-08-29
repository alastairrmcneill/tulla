-- Row-Level Security (plan 1.7).
--
-- Helper functions come first because policies reference them.
--
-- `is_team_member`/`is_team_admin` are a correctness requirement, not a
-- stylistic choice: team_members needs a "same-team members can see each
-- other's row" SELECT policy, but a policy on team_members that queries
-- team_members directly (a raw self-join) makes Postgres re-apply that same
-- policy to the inner query, which re-triggers the outer policy, etc. —
-- "infinite recursion detected in policy for relation team_members" at
-- runtime. `security definer` functions run as the function owner (which
-- owns the table too, so isn't subject to its own RLS), breaking the cycle.
-- This is the standard Supabase-documented pattern for self-referencing
-- membership tables; the tech plan's literal example SQL never hits this
-- because it only shows daily_checkins referencing team_members, not
-- team_members referencing itself.
create function is_team_member (p_team_id uuid, p_profile_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and profile_id = p_profile_id
  );
$$;

create function is_team_admin (p_team_id uuid, p_profile_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and profile_id = p_profile_id and role = 'admin'
  );
$$;

-- Does this profile currently have active coach access (trial or paid)?
-- Reads trial_length_days from the row instead of a hardcoded
-- `interval '7 days'` (tech plan §4's literal example hardcodes it; 1.6
-- added the column specifically so this doesn't have to).
create function has_coach_access (p_profile_id uuid) returns boolean language sql stable security definer
set
  search_path = '' as $$
  select exists (
    select 1 from public.billing_status
    where profile_id = p_profile_id
    and (
      (trial_started_at is not null
       and trial_started_at > now() - (trial_length_days::text || ' days')::interval)
      or subscription_active = true
    )
  );
$$;

-- profiles --------------------------------------------------------------
alter table profiles enable row level security;

-- Own row, or a teammate's row (roster needs to show other members' names —
-- team_members' own policy only covers membership rows, not the profiles
-- data those rows point to).
create policy "profiles_select_own_or_teammate" on profiles for select using (
  id = auth.uid ()
  or exists (
    select 1
    from team_members tm_self
      join team_members tm_other on tm_other.team_id = tm_self.team_id
    where
      tm_self.profile_id = auth.uid ()
      and tm_other.profile_id = profiles.id
  )
);

create policy "profiles_update_own" on profiles
for update
  using (id = auth.uid ())
with
  check (id = auth.uid ());

-- No insert policy — profile rows are created by the auth.users trigger
-- (1.9), running as a privileged role, never a direct client insert.

-- billing_status ----------------------------------------------------------
alter table billing_status enable row level security;

create policy "billing_status_select_own" on billing_status for select using (profile_id = auth.uid ());

-- Deliberately no insert/update/delete policy for `authenticated` at all —
-- only service_role (RevenueCat webhook, trial-start trigger) can write.

-- teams -------------------------------------------------------------------
alter table teams enable row level security;

create policy "teams_select_member" on teams for select using (is_team_member (id, auth.uid ()));

-- Team creation itself isn't gated — the trial is (tech plan §7).
create policy "teams_insert_any_authenticated" on teams for insert
with
  check (created_by = auth.uid ());

create policy "teams_update_admin" on teams
for update
  using (is_team_admin (id, auth.uid ()));

-- team_members --------------------------------------------------------------
alter table team_members enable row level security;

-- Roster visibility (name/role, not wellness data) — any member of the
-- same team, not gated by has_coach_access(): seeing who's on the team
-- isn't the paid part.
create policy "team_members_select_same_team" on team_members for select using (
  profile_id = auth.uid ()
  or is_team_member (team_id, auth.uid ())
);

-- Self-insert only — covers both team creation (creator adds themselves as
-- admin) and joining (3.9's consent-accept writes consent_given_at as part
-- of this same insert, not a separate update).
create policy "team_members_insert_self" on team_members for insert
with
  check (profile_id = auth.uid ());

-- Promote/remove (3.5) — admin of that team only.
create policy "team_members_update_admin" on team_members
for update
  using (is_team_admin (team_id, auth.uid ()))
with
  check (is_team_admin (team_id, auth.uid ()));

create policy "team_members_delete_admin" on team_members for delete using (is_team_admin (team_id, auth.uid ()));

-- custom_questions ------------------------------------------------------
alter table custom_questions enable row level security;

-- Visible to any member of the team (athlete's check-in form *and* the
-- coach's setup screen both read this) — but only while the team's admin
-- currently has coach access. This is deliberate, not an oversight: 3.8
-- requires custom questions to stop appearing on the athlete's check-in
-- once the team is locked, so the athlete-side read has to be gated on the
-- team's access too, not just the coach-side read.
create policy "custom_questions_select_active_team" on custom_questions for select using (
  is_team_member (team_id, auth.uid ())
  and exists (
    select 1
    from team_members tm_admin
    where
      tm_admin.team_id = custom_questions.team_id
      and tm_admin.role = 'admin'
      and has_coach_access (tm_admin.profile_id)
  )
);

-- Write policies are an addition beyond 1.7's literal task text (confirmed
-- with the user) — without them this table is 100% write-locked and no
-- later task (3.6 builds the UI, doesn't revisit RLS) would add them.
create policy "custom_questions_insert_admin" on custom_questions for insert
with
  check (
    is_team_admin (team_id, auth.uid ())
    and has_coach_access (auth.uid ())
  );

create policy "custom_questions_update_admin" on custom_questions
for update
  using (
    is_team_admin (team_id, auth.uid ())
    and has_coach_access (auth.uid ())
  );

create policy "custom_questions_delete_admin" on custom_questions for delete using (
  is_team_admin (team_id, auth.uid ())
  and has_coach_access (auth.uid ())
);

-- daily_checkins ----------------------------------------------------------
alter table daily_checkins enable row level security;

create policy "daily_checkins_select_own" on daily_checkins for select using (profile_id = auth.uid ());

-- Coach reads an athlete's check-ins only while: the coach has active
-- access, the coach administers a team that athlete belongs to, AND that
-- athlete has actually given consent on that team (product spec §8 — a
-- check-in isn't coach-visible until consent is given; baked in now per
-- the user's call rather than deferred to 3.9).
create policy "daily_checkins_coach_select" on daily_checkins for select using (
  exists (
    select 1
    from team_members tm_athlete
    where
      tm_athlete.profile_id = daily_checkins.profile_id
      and tm_athlete.consent_given_at is not null
      and is_team_admin (tm_athlete.team_id, auth.uid ())
      and has_coach_access (auth.uid ())
  )
);

create policy "daily_checkins_insert_own" on daily_checkins for insert
with
  check (profile_id = auth.uid ());

create policy "daily_checkins_update_own" on daily_checkins
for update
  using (profile_id = auth.uid ())
with
  check (profile_id = auth.uid ());

-- custom_question_responses ------------------------------------------------
alter table custom_question_responses enable row level security;

create policy "cqr_select_own" on custom_question_responses for select using (
  exists (
    select 1
    from daily_checkins
    where
      daily_checkins.id = custom_question_responses.checkin_id
      and daily_checkins.profile_id = auth.uid ()
  )
);

-- Same consent-gated coach-read pattern as daily_checkins, joined through
-- the parent check-in.
create policy "cqr_coach_select" on custom_question_responses for select using (
  exists (
    select 1
    from daily_checkins dc
      join team_members tm_athlete on tm_athlete.profile_id = dc.profile_id
    where
      dc.id = custom_question_responses.checkin_id
      and tm_athlete.consent_given_at is not null
      and is_team_admin (tm_athlete.team_id, auth.uid ())
      and has_coach_access (auth.uid ())
  )
);

-- Addition beyond 1.7's literal task text (confirmed with the user) — the
-- check-in flow (2.5) can't submit custom question answers without this.
create policy "cqr_insert_own" on custom_question_responses for insert
with
  check (
    exists (
      select 1
      from daily_checkins
      where
        daily_checkins.id = custom_question_responses.checkin_id
        and daily_checkins.profile_id = auth.uid ()
    )
  );

-- body_map_entries ----------------------------------------------------------
alter table body_map_entries enable row level security;

create policy "body_map_entries_select_own" on body_map_entries for select using (profile_id = auth.uid ());

create policy "body_map_entries_coach_select" on body_map_entries for select using (
  exists (
    select 1
    from team_members tm_athlete
    where
      tm_athlete.profile_id = body_map_entries.profile_id
      and tm_athlete.consent_given_at is not null
      and is_team_admin (tm_athlete.team_id, auth.uid ())
      and has_coach_access (auth.uid ())
  )
);

-- Addition beyond 1.7's literal task text (confirmed with the user) — 2.7
-- can't write body-map entries without this. Append-only per 2.2's design,
-- so no update/delete policy.
create policy "body_map_entries_insert_own" on body_map_entries for insert
with
  check (profile_id = auth.uid ());

-- rpe_logs ------------------------------------------------------------------
alter table rpe_logs enable row level security;

create policy "rpe_logs_select_own" on rpe_logs for select using (profile_id = auth.uid ());

create policy "rpe_logs_coach_select" on rpe_logs for select using (
  exists (
    select 1
    from team_members tm_athlete
    where
      tm_athlete.profile_id = rpe_logs.profile_id
      and tm_athlete.consent_given_at is not null
      and is_team_admin (tm_athlete.team_id, auth.uid ())
      and has_coach_access (auth.uid ())
  )
);

-- Addition beyond 1.7's literal task text (confirmed with the user) — 2.8
-- can't write RPE logs without this. Append-only per 2.2's design, so no
-- update/delete policy.
create policy "rpe_logs_insert_own" on rpe_logs for insert
with
  check (profile_id = auth.uid ());

-- notifications ---------------------------------------------------------
alter table notifications enable row level security;

create policy "notifications_select_own" on notifications for select using (profile_id = auth.uid ());

create policy "notifications_update_own" on notifications
for update
  using (profile_id = auth.uid ())
with
  check (profile_id = auth.uid ());

-- No insert policy for `authenticated` — notifications are created by
-- triggers/Edge Functions (5.9, 5.10) running as service_role.
