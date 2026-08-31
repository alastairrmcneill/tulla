-- Personal baseline computation (plan 3.1).
--
-- security invoker (the default — no `security definer` here): these
-- functions read `daily_checkins` as the calling role, so the table's
-- existing RLS policies (own row, or coach with consent + active access)
-- apply unchanged. Unlike `is_team_member`/`has_coach_access` (1.7), there's
-- no self-referencing-table recursion problem to route around, so there's
-- no reason to bypass RLS and re-derive the same auth logic in here.

-- Generic single-metric rolling baseline. Window is lagged
-- (p_as_of - p_window_days .. p_as_of - 1) so the day being compared never
-- contributes to its own baseline. coverage = distinct dates with a
-- daily_checkins row in that window (unique(profile_id, date) means this
-- equals row count). sd floored at 0.5. mean/sd are null when coverage is
-- short of p_min_coverage — callers must render "insufficient data yet",
-- never treat a null as zero deviation.
create function public.rolling_baseline (
  p_profile_id uuid,
  p_metric text,
  p_window_days int,
  p_min_coverage int,
  p_as_of date default current_date
) returns table (mean numeric, sd numeric, coverage int, sufficient boolean) language plpgsql stable
set search_path = '' as $$
declare
  v_mean numeric;
  v_sd numeric;
  v_coverage int;
begin
  if p_metric not in ('fatigue', 'sleep', 'muscle_soreness', 'stress', 'mood') then
    raise exception 'rolling_baseline: invalid metric %', p_metric;
  end if;

  -- p_metric is validated against a fixed allowlist above, so this dynamic
  -- identifier is safe from injection despite %I already escaping it.
  execute format(
    'select avg(%1$I), stddev_samp(%1$I), count(distinct date)
     from public.daily_checkins
     where profile_id = $1 and date >= $2 and date <= $3',
    p_metric
  )
    into v_mean, v_sd, v_coverage
    using p_profile_id, p_as_of - p_window_days, p_as_of - 1;

  v_coverage := coalesce(v_coverage, 0);

  return query
  select
    case when v_coverage >= p_min_coverage then v_mean else null end,
    case when v_coverage >= p_min_coverage then greatest(v_sd, 0.5) else null end,
    v_coverage,
    v_coverage >= p_min_coverage;
end;
$$;

-- The comparison baseline: one row per metric, so a single RPC call feeds
-- RadarChart's full Record<Metric, ...> (3.2) and the coach flagged-list's
-- per-metric z-scores (4.4) without 5 separate round trips.
create function public.athlete_baseline_14 (p_profile_id uuid, p_as_of date default current_date) returns table (
  metric text,
  mean numeric,
  sd numeric,
  coverage int,
  sufficient boolean
) language sql stable
set search_path = '' as $$
  select m.metric, b.mean, b.sd, b.coverage, b.sufficient
  from unnest(array['fatigue', 'sleep', 'muscle_soreness', 'stress', 'mood']) as m (metric)
  cross join lateral public.rolling_baseline (p_profile_id, m.metric, 14, 10, p_as_of) as b;
$$;

-- Secondary 28-day drift reference. Computed and exposed only — no UI or
-- flag logic consumes it yet (that's a later ticket, not this one).
create function public.athlete_baseline_28 (p_profile_id uuid, p_as_of date default current_date) returns table (
  metric text,
  mean numeric,
  sd numeric,
  coverage int,
  sufficient boolean
) language sql stable
set search_path = '' as $$
  select m.metric, b.mean, b.sd, b.coverage, b.sufficient
  from unnest(array['fatigue', 'sleep', 'muscle_soreness', 'stress', 'mood']) as m (metric)
  cross join lateral public.rolling_baseline (p_profile_id, m.metric, 28, 20, p_as_of) as b;
$$;
