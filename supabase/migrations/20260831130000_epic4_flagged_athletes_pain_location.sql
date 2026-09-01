-- Design-fidelity follow-up: Team Home's flagged-list pain chip reads
-- "Hamstring pain" (body location), not the severity word — team_home
-- needs the location back from team_flagged_athletes(), not just severity.
--
-- Adding a column to a RETURNS TABLE function isn't a CREATE OR REPLACE-safe
-- change (Postgres: "cannot change return type of existing function") — drop
-- first.
drop function if exists public.team_flagged_athletes (uuid);

create function public.team_flagged_athletes (p_team_id uuid) returns table (
  profile_id uuid,
  name text,
  pain_reported boolean,
  pain_severity text,
  pain_location text,
  below_baseline boolean,
  below_baseline_metric text,
  below_baseline_z numeric,
  rising_load boolean,
  load_this_week numeric,
  load_last_week numeric,
  priority int
) language sql stable
set search_path = '' as $$
  with roster as (
    select tm.profile_id, p.name
    from public.team_members tm
    join public.profiles p on p.id = tm.profile_id
    where tm.team_id = p_team_id and tm.role = 'athlete'
  ),
  -- Meaningful pain: a moderate/severe body-map entry today. A `mild` entry
  -- alone never flags (locked decision, CODING_PLAN.md). Location comes from
  -- whichever entry is most severe (ties broken by most recent).
  pain as (
    select roster.profile_id, top.severity_level as pain_level, top.location as pain_location
    from roster
      left join lateral (
        select
          case bme.severity
            when 'severe' then 2
            when 'moderate' then 1
            else 0
          end as severity_level,
          bme.location
        from public.body_map_entries bme
        where
          bme.profile_id = roster.profile_id
          and bme.date = current_date
          and bme.severity in ('moderate', 'severe')
        order by severity_level desc, bme.created_at desc
        limit 1
      ) top on true
  ),
  -- Per-metric z-score against athlete_baseline_14, for whichever metric on
  -- today's check-in deviates most. z is null wherever that metric's
  -- baseline isn't sufficient yet (3.1) — never treated as a deviation.
  baseline_check as (
    select
      roster.profile_id,
      b.metric,
      case
        when b.sufficient
        and dc.value is not null then (dc.value - b.mean) / b.sd
        else null
      end as z
    from roster
      cross join lateral public.athlete_baseline_14 (roster.profile_id) b
      left join lateral (
        select
          case b.metric
            when 'fatigue' then d.fatigue
            when 'sleep' then d.sleep
            when 'muscle_soreness' then d.muscle_soreness
            when 'stress' then d.stress
            when 'mood' then d.mood
          end::numeric as value
        from public.daily_checkins d
        where
          d.profile_id = roster.profile_id
          and d.date = current_date
      ) dc on true
  ),
  -- "The most-deviated metric" per athlete — one row, the lowest z-score at
  -- or below the -1.5 flag threshold (locked decision).
  worst_baseline as (
    select
      profile_id,
      metric,
      z
    from (
      select
        profile_id,
        metric,
        z,
        row_number() over (
          partition by
            profile_id
          order by
            z asc
        ) as rn
      from baseline_check
      where
        z is not null
        and z <= -1.5
    ) ranked
    where
      rn = 1
  ),
  -- Rolling 7-day windows lagged off current_date — same rule 3.8's
  -- `computeLoadTrend` uses for its trend arrow (not calendar weeks).
  load as (
    select
      roster.profile_id,
      coalesce(
        sum(
          case
            when r.logged_at::date between current_date - 6 and current_date then r.rpe_value
          end
        ),
        0
      ) as this_week,
      coalesce(
        sum(
          case
            when r.logged_at::date between current_date - 13 and current_date - 7 then r.rpe_value
          end
        ),
        0
      ) as last_week
    from roster
      left join public.rpe_logs r on r.profile_id = roster.profile_id
    group by
      roster.profile_id
  ),
  rising as (
    select
      profile_id,
      this_week,
      last_week,
      (
        (last_week = 0 and this_week > 0)
        or (last_week > 0 and this_week > last_week * 1.1)
      ) as is_rising
    from load
  )
  select
    roster.profile_id,
    roster.name,
    coalesce(pain.pain_level, 0) > 0 as pain_reported,
    case pain.pain_level
      when 2 then 'severe'
      when 1 then 'moderate'
      else null
    end as pain_severity,
    pain.pain_location,
    worst_baseline.metric is not null as below_baseline,
    worst_baseline.metric as below_baseline_metric,
    worst_baseline.z as below_baseline_z,
    coalesce(rising.is_rising, false) as rising_load,
    rising.this_week as load_this_week,
    rising.last_week as load_last_week,
    -- Priority bucket: pain > below_baseline > rising_load (locked decision).
    case
      when coalesce(pain.pain_level, 0) > 0 then 1
      when worst_baseline.metric is not null then 2
      when coalesce(rising.is_rising, false) then 3
    end as priority
  from roster
    left join pain on pain.profile_id = roster.profile_id
    left join worst_baseline on worst_baseline.profile_id = roster.profile_id
    left join rising on rising.profile_id = roster.profile_id
  where
    coalesce(pain.pain_level, 0) > 0
    or worst_baseline.metric is not null
    or coalesce(rising.is_rising, false)
  order by
    priority,
    -- Magnitude within a bucket: pain severity, then |z|, then % load
    -- increase (a from-zero rise sorts as the largest possible increase).
    case
      when coalesce(pain.pain_level, 0) > 0 then pain.pain_level::numeric
      when worst_baseline.metric is not null then abs(worst_baseline.z)
      when rising.last_week = 0 then 'infinity'::numeric
      else (rising.this_week - rising.last_week) / rising.last_week
    end desc;
$$;
