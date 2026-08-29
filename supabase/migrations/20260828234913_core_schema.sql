-- Core schema (plan 1.6). RLS is deliberately NOT enabled here — see 1.7.
-- Tables created in dependency order.

-- profiles ------------------------------------------------------------
-- No `theme` column (device-local, tech plan §3) and no billing columns
-- (own table below, so RLS can lock billing_status down independently of
-- the columns a user is allowed to self-edit here).
create table profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  name text,
  notification_time time,
  created_at timestamptz not null default now()
);

-- billing_status --------------------------------------------------------
-- `trial_length_days` is an addition beyond the tech plan's literal example
-- SQL (which hardcodes `interval '7 days'`) — needed so 4.4 can make trial
-- length config-driven/A-B-testable per profile instead of a fixed constant.
create table billing_status (
  profile_id uuid primary key references profiles (id) on delete cascade,
  trial_started_at timestamptz,
  trial_length_days int not null default 7,
  subscription_active boolean not null default false,
  subscription_expires_at timestamptz,
  revenuecat_customer_id text
);

-- teams -------------------------------------------------------------------
create table teams (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  sport text,
  created_by uuid not null references profiles (id),
  join_code text not null unique,
  created_at timestamptz not null default now()
);

-- team_members --------------------------------------------------------------
-- unique(team_id, profile_id) is an addition beyond the tech plan's literal
-- column list — without it nothing stops a duplicate membership row, which
-- would double-count an athlete in coach-side aggregate queries (3.1, 3.3).
create table team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  profile_id uuid not null references profiles (id) on delete cascade,
  role text not null check (role in ('athlete', 'admin')),
  consent_given_at timestamptz,
  joined_at timestamptz not null default now(),
  unique (team_id, profile_id)
);

-- custom_questions ------------------------------------------------------
create table custom_questions (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null references teams (id) on delete cascade,
  question_text text not null,
  type text not null check (type in ('scale', 'yes_no', 'text')),
  required boolean not null default false,
  sort_order int not null default 0
);

-- Max 2 custom questions per team, enforced at the layer a UI bug can't
-- bypass (tech plan §3 / plan 1.6's own note prefers a trigger over an
-- application-layer check).
create function enforce_max_custom_questions () returns trigger as $$
begin
  if (select count(*) from custom_questions where team_id = new.team_id) >= 2 then
    raise exception 'A team can have at most 2 custom questions';
  end if;
  return new;
end;
$$ language plpgsql;

create trigger trg_max_custom_questions before insert on custom_questions for each row
execute function enforce_max_custom_questions ();

-- daily_checkins ----------------------------------------------------------
-- Not team-scoped (tech plan §3) — one check-in per profile per day,
-- visible to any team that profile belongs to.
create table daily_checkins (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  date date not null,
  fatigue int not null check (fatigue between 1 and 5),
  sleep int not null check (sleep between 1 and 5),
  muscle_soreness int not null check (muscle_soreness between 1 and 5),
  stress int not null check (stress between 1 and 5),
  mood int not null check (mood between 1 and 5),
  availability int not null check (availability between 1 and 3),
  wellness_score numeric,
  created_at timestamptz not null default now(),
  unique (profile_id, date)
);

-- custom_question_responses ------------------------------------------------
-- response_value is text regardless of the parent question's `type`
-- (scale/yes_no/text) — parsed client-side per that type, since a single
-- column can't hold three different shapes of answer.
create table custom_question_responses (
  id uuid primary key default gen_random_uuid(),
  checkin_id uuid not null references daily_checkins (id) on delete cascade,
  custom_question_id uuid not null references custom_questions (id) on delete cascade,
  response_value text
);

-- body_map_entries ----------------------------------------------------------
create table body_map_entries (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  date date not null default current_date,
  location text not null,
  severity text not null check (severity in ('mild', 'moderate', 'severe')),
  note text,
  created_at timestamptz not null default now()
);

-- rpe_logs ------------------------------------------------------------------
-- logged_at is a timestamptz, not just a date — multiple sessions/day are
-- possible (tech plan §3).
create table rpe_logs (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  logged_at timestamptz not null default now(),
  rpe_value int not null check (rpe_value between 1 and 10),
  note text
);

-- notifications ---------------------------------------------------------
create table notifications (
  id uuid primary key default gen_random_uuid(),
  profile_id uuid not null references profiles (id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  read boolean not null default false,
  related_team_id uuid references teams (id) on delete set null,
  created_at timestamptz not null default now()
);

-- Indexes ---------------------------------------------------------------
create index idx_daily_checkins_profile_date on daily_checkins (profile_id, date);

create index idx_team_members_team_profile on team_members (team_id, profile_id);

create index idx_rpe_logs_profile_logged_at on rpe_logs (profile_id, logged_at);
