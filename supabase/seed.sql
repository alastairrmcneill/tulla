-- Demo/dev seed data (not a migration — schema stays in migrations/, this is
-- throwaway content for local `supabase db reset` and manual QA). Assumes
-- the dev's own account (created via the app's real sign-up flow) already
-- exists; everything here hangs off that one real coach so the running app,
-- logged in as that account, shows populated Team Home / Roster / Athlete
-- Detail / All Responses screens without a second login.
--
-- Coach: whichever profile created 'Alba' during manual testing
-- (a2437be7-bdd3-4ccf-a2f7-20e966fa66d2 on the dev project — adjust below if
-- reused against a fresh project). Three teams demonstrate the states 4.5's
-- Done-when calls out: a populated+flagged team, a populated+nothing-flagged
-- team, and a genuinely empty team.

do $$
declare
  v_coach uuid := 'a2437be7-bdd3-4ccf-a2f7-20e966fa66d2';
  v_alba uuid;
  v_hockey uuid := '22222222-2222-2222-2222-222222222201';
  v_oakwood uuid := '22222222-2222-2222-2222-222222222202';

  v_priya uuid := '11111111-1111-1111-1111-111111111101';
  v_jordan uuid := '11111111-1111-1111-1111-111111111102';
  v_sam uuid := '11111111-1111-1111-1111-111111111103';
  v_emma uuid := '11111111-1111-1111-1111-111111111104';
  v_liam uuid := '11111111-1111-1111-1111-111111111105';
  v_chloe uuid := '11111111-1111-1111-1111-111111111106';
  v_noah uuid := '11111111-1111-1111-1111-111111111107';
  v_ava uuid := '11111111-1111-1111-1111-111111111108';
  v_ethan uuid := '11111111-1111-1111-1111-111111111109';

  v_q_hydration uuid;
  v_q_niggles uuid;
  v_checkin_priya uuid;
  v_checkin_jordan uuid;
  v_checkin_sam uuid;
begin
  -- Name the coach, if not already set.
  update public.profiles set name = coalesce(name, 'Alastair McNeill') where id = v_coach;

  select id into v_alba from public.teams where created_by = v_coach and name = 'Alba' limit 1;
  if v_alba is null then
    v_alba := gen_random_uuid();
    insert into public.teams (id, name, sport, created_by, join_code) values (v_alba, 'Alba', 'Football', v_coach, 'ALBA01');
    insert into public.team_members (team_id, profile_id, role) values (v_alba, v_coach, 'admin');
  end if;

  insert into public.teams (id, name, sport, created_by, join_code) values
    (v_hockey, 'Uni Hockey 2s', 'Hockey', v_coach, 'HOCK02'),
    (v_oakwood, 'Oakwood Netball', 'Netball', v_coach, 'OAKW03')
  on conflict (id) do nothing;

  insert into public.team_members (team_id, profile_id, role) values
    (v_hockey, v_coach, 'admin'),
    (v_oakwood, v_coach, 'admin')
  on conflict (team_id, profile_id) do nothing;

  -- Nine athlete accounts, real auth.users rows (profiles are created by the
  -- 1.9 trigger) so RLS treats them exactly like a real signed-up athlete.
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change
  )
  select '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
    crypt('tulla-demo-password', gen_salt('bf')), now(), '{"provider":"email","providers":["email"]}', '{}', now(), now(), '', '', '', ''
  from (
    values
      (v_priya, 'priya.nair@tulla.demo'), (v_jordan, 'jordan.blake@tulla.demo'), (v_sam, 'sam.torres@tulla.demo'),
      (v_emma, 'emma.wallace@tulla.demo'), (v_liam, 'liam.carter@tulla.demo'), (v_chloe, 'chloe.davies@tulla.demo'),
      (v_noah, 'noah.kim@tulla.demo'), (v_ava, 'ava.patel@tulla.demo'), (v_ethan, 'ethan.brooks@tulla.demo')
  ) as u (id, email)
  on conflict (id) do nothing;

  update public.profiles set name = v.name from (
    values
      (v_priya, 'Priya Nair'), (v_jordan, 'Jordan Blake'), (v_sam, 'Sam Torres'), (v_emma, 'Emma Wallace'), (v_liam, 'Liam Carter'),
      (v_chloe, 'Chloe Davies'), (v_noah, 'Noah Kim'), (v_ava, 'Ava Patel'), (v_ethan, 'Ethan Brooks')
  ) as v (id, name)
  where profiles.id = v.id;

  -- Roster: Alba (5 athletes, one of every flag state + one "missing" today).
  insert into public.team_members (team_id, profile_id, role, consent_given_at) values
    (v_alba, v_priya, 'athlete', now()), (v_alba, v_jordan, 'athlete', now()), (v_alba, v_sam, 'athlete', now()),
    (v_alba, v_emma, 'athlete', now()), (v_alba, v_liam, 'athlete', now())
  on conflict (team_id, profile_id) do nothing;

  -- Roster: Uni Hockey 2s (4 athletes, all checked in, nobody flagged).
  insert into public.team_members (team_id, profile_id, role, consent_given_at) values
    (v_hockey, v_chloe, 'athlete', now()), (v_hockey, v_noah, 'athlete', now()),
    (v_hockey, v_ava, 'athlete', now()), (v_hockey, v_ethan, 'athlete', now())
  on conflict (team_id, profile_id) do nothing;

  -- Oakwood Netball intentionally gets no athletes — the empty-team state.

  -- Priya: 12 days of steady baseline history, then a low fatigue today
  -- (below_baseline) + a severe body-map entry today (pain_reported).
  insert into public.daily_checkins (profile_id, date, fatigue, sleep, muscle_soreness, stress, mood, availability)
  select v_priya, current_date - d, 4, 4, 3, 3, 4, 2 from generate_series(2, 13) as d
  on conflict (profile_id, date) do nothing;

  insert into public.daily_checkins (profile_id, date, fatigue, sleep, muscle_soreness, stress, mood, availability, wellness_score)
  values (v_priya, current_date, 1, 3, 2, 3, 3, 2, 37.5)
  on conflict (profile_id, date) do update set fatigue = excluded.fatigue
  returning id into v_checkin_priya;

  insert into public.body_map_entries (profile_id, date, location, severity, note) values
    (v_priya, current_date, 'leg_left', 'severe', 'tight since Sunday''s game'),
    (v_priya, current_date - 3, 'leg_left', 'moderate', null);

  -- Jordan: same idea, different metric (mood) so the two below-baseline
  -- examples don't look identical.
  insert into public.daily_checkins (profile_id, date, fatigue, sleep, muscle_soreness, stress, mood, availability)
  select v_jordan, current_date - d, 3, 3, 3, 3, 4, 2 from generate_series(2, 13) as d
  on conflict (profile_id, date) do nothing;

  insert into public.daily_checkins (profile_id, date, fatigue, sleep, muscle_soreness, stress, mood, availability, wellness_score)
  values (v_jordan, current_date, 3, 3, 3, 3, 1, 2, 50)
  on conflict (profile_id, date) do update set mood = excluded.mood
  returning id into v_checkin_jordan;

  -- Sam: rising training load this week vs last (no pain, no below-baseline).
  insert into public.daily_checkins (profile_id, date, fatigue, sleep, muscle_soreness, stress, mood, availability, wellness_score)
  values (v_sam, current_date, 3, 3, 3, 3, 3, 3, 50)
  on conflict (profile_id, date) do update set fatigue = excluded.fatigue
  returning id into v_checkin_sam;

  insert into public.rpe_logs (profile_id, logged_at, rpe_value, note) values
    (v_sam, now() - interval '10 days', 3, 'Easy jog'),
    (v_sam, now() - interval '8 days', 4, 'Light gym'),
    (v_sam, now() - interval '5 days', 8, 'Match'),
    (v_sam, now() - interval '3 days', 8, 'Hard session'),
    (v_sam, now() - interval '1 days', 9, 'Match'),
    (v_sam, now(), 8, 'Training');

  -- RPE logs for Priya/Jordan so their Athlete Detail chart isn't empty —
  -- matched last-week/this-week totals so *only* Sam trips rising_load
  -- (an athlete with sessions only in "this week" and none the week before
  -- reads as a from-zero spike per the locked rule, which briefly flagged
  -- both of these two by accident during seeding — fixed by giving both a
  -- comparable prior week instead of leaving last_week at zero).
  insert into public.rpe_logs (profile_id, logged_at, rpe_value) values
    (v_priya, now() - interval '12 days', 6), (v_priya, now() - interval '10 days', 6), (v_priya, now() - interval '8 days', 6),
    (v_priya, now() - interval '4 days', 6), (v_priya, now() - interval '2 days', 7), (v_priya, now(), 5),
    (v_jordan, now() - interval '12 days', 5), (v_jordan, now() - interval '10 days', 5), (v_jordan, now() - interval '8 days', 6),
    (v_jordan, now() - interval '4 days', 5), (v_jordan, now() - interval '2 days', 6), (v_jordan, now(), 6);

  -- Emma: normal check-in, nothing flagged.
  insert into public.daily_checkins (profile_id, date, fatigue, sleep, muscle_soreness, stress, mood, availability, wellness_score)
  values (v_emma, current_date, 4, 4, 4, 4, 4, 3, 75)
  on conflict (profile_id, date) do nothing;

  -- Liam gets no check-in at all today — the "missing" / remind-me case.

  -- Uni Hockey 2s: everyone checked in, nobody flagged.
  insert into public.daily_checkins (profile_id, date, fatigue, sleep, muscle_soreness, stress, mood, availability, wellness_score) values
    (v_chloe, current_date, 4, 4, 4, 4, 4, 3, 75), (v_noah, current_date, 3, 4, 4, 3, 4, 2, 62.5),
    (v_ava, current_date, 4, 3, 3, 4, 4, 3, 62.5), (v_ethan, current_date, 4, 4, 3, 4, 4, 2, 68.75)
  on conflict (profile_id, date) do nothing;

  -- Two custom questions on Alba, plus a couple of answered responses today.
  insert into public.custom_questions (team_id, question_text, type, required, sort_order)
  values (v_alba, 'Hydration since last session', 'scale', false, 0)
  returning id into v_q_hydration;

  insert into public.custom_questions (team_id, question_text, type, required, sort_order)
  values (v_alba, 'Any niggles from training?', 'yes_no', true, 1)
  returning id into v_q_niggles;

  insert into public.custom_question_responses (checkin_id, custom_question_id, response_value) values
    (v_checkin_priya, v_q_hydration, '2'), (v_checkin_priya, v_q_niggles, 'Yes'),
    (v_checkin_jordan, v_q_hydration, '4'), (v_checkin_jordan, v_q_niggles, 'No'),
    (v_checkin_sam, v_q_hydration, '3'), (v_checkin_sam, v_q_niggles, 'No');
  -- Emma deliberately leaves both unanswered — shows the "no answers yet" state.
end $$;
